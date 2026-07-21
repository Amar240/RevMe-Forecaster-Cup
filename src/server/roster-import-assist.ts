import crypto from 'crypto'
import type { Prisma, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { archiveImportFile } from '@/lib/import-archive'
import { applyTeamImportOverrides } from '@/lib/team-import/overrides'
import { columnMappingSchema, repairOutputSchema, suggestionId, TEAM_IMPORT_CANONICAL_FIELDS } from '@/lib/team-import/assist'
import { getTeamImportHeaderCoverage, parseTeamImportFile, readTeamImportGrid } from '@/lib/team-import/parser'
import { validateTeamImport } from '@/lib/team-import/validate'
import type { ImportAssistSuggestion, TeamImportColumnMapping, TeamImportOverride } from '@/lib/team-import/types'
import { invokeImportAssist } from './import-assist'

type Actor = Pick<User, 'id' | 'role' | 'universityId' | 'email'>
type AssistSummary = { assist?: { suggestions?: ImportAssistSuggestion[] }; [key: string]: unknown }
const hash = (buffer: Buffer) => crypto.createHash('sha256').update(buffer).digest('hex')
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

function authorize(actor: Actor) {
  if (actor.role !== 'SUPERVISOR' && actor.role !== 'ADMIN') throw new ApiError('Import assist access required', 403, 'FORBIDDEN')
}

async function getBatch(args: { actor: Actor; batchId: string; seasonId: string; fileBuffer?: Buffer; fileHash?: string }) {
  authorize(args.actor)
  const batch = await prisma.importBatch.findUnique({ where: { id: args.batchId } })
  if (!batch) throw new ApiError('Import batch not found', 404, 'NOT_FOUND')
  if (batch.uploaderId !== args.actor.id || batch.seasonId !== args.seasonId) throw new ApiError('Import batch does not belong to this request', 403, 'FORBIDDEN')
  if (batch.status !== 'PREVIEWED') throw new ApiError('Import assist is available only during preview', 409, 'CONFLICT')
  if (args.fileBuffer && (hash(args.fileBuffer) !== batch.fileHash || args.fileHash !== batch.fileHash)) throw new ApiError('Workbook has changed since preview', 409, 'CONFLICT')
  return batch
}

async function appendSuggestions(batchId: string, suggestions: ImportAssistSuggestion[]) {
  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: batchId }, select: { summaryJson: true } })
  const summary = (batch.summaryJson ?? {}) as AssistSummary
  const existing = summary.assist?.suggestions ?? []
  const merged = [...existing]
  for (const suggestion of suggestions) if (!merged.some((item) => item.id === suggestion.id)) merged.push(suggestion)
  await prisma.importBatch.update({ where: { id: batchId }, data: { summaryJson: json({ ...summary, assist: { ...summary.assist, suggestions: merged } }) } })
}

export async function suggestRosterLayout(args: { actor: Actor; seasonId: string; fileName: string; fileBuffer: Buffer; batchId?: string | null; fileHash?: string | null }) {
  authorize(args.actor)
  const actualHash = hash(args.fileBuffer)
  let batch = args.batchId ? await getBatch({ actor: args.actor, batchId: args.batchId, seasonId: args.seasonId, fileBuffer: args.fileBuffer, fileHash: args.fileHash ?? undefined }) : null
  const grid = readTeamImportGrid({ fileName: args.fileName, fileBuffer: args.fileBuffer })
  let parseFailed = false
  try { await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer }) } catch { parseFailed = true }
  const coverage = getTeamImportHeaderCoverage(grid)
  if (!parseFailed && coverage >= 0.8) throw new ApiError('This workbook does not need layout assistance', 422, 'INVALID_INPUT')
  if (!batch) {
    batch = await prisma.importBatch.create({ data: { uploaderId: args.actor.id, uploaderRole: args.actor.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'ADMIN', seasonId: args.seasonId, universityId: args.actor.role === 'SUPERVISOR' ? args.actor.universityId : null, fileName: args.fileName, fileHash: actualHash, status: 'PREVIEWED', summaryJson: json({ assist: { suggestions: [] } }) } })
    const s3Key = await archiveImportFile({ seasonId: args.seasonId, batchId: batch.id, fileName: args.fileName, fileBuffer: args.fileBuffer })
    if (s3Key) await prisma.importBatch.update({ where: { id: batch.id }, data: { s3Key } })
  }
  const mapping = await invokeImportAssist({ system: 'Map this roster header to the supplied canonical fields. Return JSON only. Never invent workbook content.', input: { rows: grid.slice(0, 10), canonicalFields: TEAM_IMPORT_CANONICAL_FIELDS }, schema: columnMappingSchema })
  if (!mapping) return { batchId: batch.id, fileHash: actualHash, available: false as const }
  const base = { useCase: 'LAYOUT' as const, suggestion: JSON.stringify(mapping), reason: 'Suggested workbook header mapping', confidence: mapping.columnMap.reduce((sum, item) => sum + item.confidence, 0) / mapping.columnMap.length }
  const suggestion = { ...base, id: suggestionId(base), outcome: 'PENDING' as const }
  await appendSuggestions(batch.id, [suggestion])
  return { batchId: batch.id, fileHash: actualHash, available: true as const, suggestion, mapping }
}

export async function suggestRosterRepairs(args: { actor: Actor; seasonId: string; batchId: string; fileHash: string; fileName: string; fileBuffer: Buffer; columnMapping?: TeamImportColumnMapping | null; overrides: TeamImportOverride[] }) {
  const batch = await getBatch({ actor: args.actor, batchId: args.batchId, seasonId: args.seasonId, fileBuffer: args.fileBuffer, fileHash: args.fileHash })
  const parsed = applyTeamImportOverrides(await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer, columnMapping: args.columnMapping }), args.overrides)
  const validation = await validateTeamImport({ seasonId: args.seasonId, parsedFile: parsed, mode: args.actor.role === 'SUPERVISOR' ? 'supervisor' : 'admin', actor: { id: args.actor.id, email: args.actor.email, universityId: args.actor.universityId } })
  const eligible = validation.rows.flatMap((row) => {
    const issues = [...row.errors, ...row.warnings].filter((issue) => /glued name|email|last name/i.test(issue))
    return [row.submitter, ...row.members].filter((person) => issues.some((issue) => issue.includes(person.provenance))).map((person) => ({ rowNumber: row.rowNumber, columnLabel: person.provenance.split(' · ')[1], firstName: person.firstName, lastName: person.lastName, email: person.email, issues: issues.filter((issue) => issue.includes(person.provenance)) }))
  })
  if (!eligible.length) throw new ApiError('No eligible person issues need assistance', 422, 'INVALID_INPUT')
  const output = await invokeImportAssist({ system: 'Suggest conservative corrections only for the supplied invalid roster person cells. Return JSON only using the requested schema.', input: { people: eligible }, schema: repairOutputSchema })
  if (!output) return { batchId: batch.id, available: false as const, suggestions: [] }
  const allowed = new Set(eligible.map((item) => `${item.rowNumber}:${item.columnLabel}`))
  const suggestions = output.repairs.filter((item) => allowed.has(`${item.rowNumber}:${item.columnLabel}`)).map((item) => { const base = { useCase: 'REPAIR' as const, ...item }; return { ...base, id: suggestionId(base), outcome: 'PENDING' as const } })
  await appendSuggestions(batch.id, suggestions)
  return { batchId: batch.id, available: true as const, suggestions }
}

export async function recordRosterAssistOutcome(args: { actor: Actor; seasonId: string; batchId: string; suggestionId: string; outcome: 'ACCEPTED' | 'REJECTED' }) {
  const batch = await getBatch({ actor: args.actor, batchId: args.batchId, seasonId: args.seasonId })
  const summary = (batch.summaryJson ?? {}) as AssistSummary
  const suggestions = summary.assist?.suggestions ?? []
  if (!suggestions.some((item) => item.id === args.suggestionId)) throw new ApiError('Assist suggestion not found', 404, 'NOT_FOUND')
  await prisma.importBatch.update({ where: { id: batch.id }, data: { summaryJson: json({ ...summary, assist: { ...summary.assist, suggestions: suggestions.map((item) => item.id === args.suggestionId ? { ...item, outcome: args.outcome } : item) } }) } })
  return { recorded: true as const }
}
