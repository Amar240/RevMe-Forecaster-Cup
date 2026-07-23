import crypto from 'crypto'
import type { Prisma, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { archiveImportFile } from '@/lib/import-archive'
import { applyTeamImportOverrides } from '@/lib/team-import/overrides'
import { columnMappingSchema, explanationOutputSchema, importAssistContextFingerprint, repairOutputSchema, suggestionId, TEAM_IMPORT_CANONICAL_FIELDS } from '@/lib/team-import/assist'
import { getTeamImportHeaderCoverage, parseTeamImportFile, readTeamImportGrid } from '@/lib/team-import/parser'
import { validateTeamImport } from '@/lib/team-import/validate'
import type { ImportAssistSuggestion, TeamImportColumnMapping, TeamImportOverride } from '@/lib/team-import/types'
import { emitImportAssistOutcomeMetric, IMPORT_ASSIST_MODEL, invokeImportAssist } from './import-assist'

type Actor = Pick<User, 'id' | 'role' | 'universityId' | 'email'>
type AssistUseCase = 'LAYOUT' | 'EXPLAIN' | 'REPAIR'
type Invocation = {
  id: string
  useCase: AssistUseCase
  modelId: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  diagnosticCodes: string[]
  contextFingerprint: string
  outcome: 'REQUESTED' | 'SUCCEEDED' | 'UNAVAILABLE'
  createdAt: string
}
type ExplanationCache = { contextFingerprint: string; summary: string; nextSteps: string[] }
type AssistData = {
  contextFingerprint?: string
  suggestions?: ImportAssistSuggestion[]
  invocations?: Invocation[]
  explanations?: ExplanationCache[]
}
type AssistSummary = { assist?: AssistData; [key: string]: unknown }
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

async function mutateAssistSummary<T>(batchId: string, mutate: (summary: AssistSummary, assist: AssistData) => T | Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${batchId}))`
    const batch = await tx.importBatch.findUniqueOrThrow({ where: { id: batchId }, select: { summaryJson: true } })
    const summary = (batch.summaryJson ?? {}) as AssistSummary
    const assist = { ...(summary.assist ?? {}) }
    const result = await mutate(summary, assist)
    await tx.importBatch.update({ where: { id: batchId }, data: { summaryJson: json({ ...summary, assist }) } })
    return result
  })
}

async function appendSuggestions(batchId: string, suggestions: ImportAssistSuggestion[]) {
  await mutateAssistSummary(batchId, (_summary, assist) => {
    const merged = [...(assist.suggestions ?? [])]
    for (const suggestion of suggestions) if (!merged.some((item) => item.id === suggestion.id)) merged.push(suggestion)
    assist.suggestions = merged
    if (suggestions[0]?.contextFingerprint) assist.contextFingerprint = suggestions[0].contextFingerprint
  })
}

async function beginInvocation(batchId: string, useCase: AssistUseCase, contextFingerprint: string, diagnosticCodes: string[]) {
  const limits = { LAYOUT: 1, EXPLAIN: 2, REPAIR: 5 }
  return mutateAssistSummary(batchId, (_summary, assist) => {
    const calls = assist.invocations ?? []
    if (calls.length >= 8 || calls.filter((item) => item.useCase === useCase).length >= limits[useCase]) {
      throw new ApiError('AI assistance limit reached for this roster version. Continue with the manual editing tools.', 429, 'RATE_LIMITED')
    }
    const id = crypto.randomUUID()
    assist.invocations = [...calls, {
      id,
      useCase,
      modelId: IMPORT_ASSIST_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      diagnosticCodes,
      contextFingerprint,
      outcome: 'REQUESTED',
      createdAt: new Date().toISOString(),
    }]
    return id
  })
}

async function finishInvocation(batchId: string, id: string, invocation: Awaited<ReturnType<typeof invokeImportAssist>>) {
  await mutateAssistSummary(batchId, (_summary, assist) => {
    assist.invocations = (assist.invocations ?? []).map((item) => item.id === id ? {
      ...item,
      modelId: invocation?.modelId ?? item.modelId,
      inputTokens: invocation?.inputTokens ?? 0,
      outputTokens: invocation?.outputTokens ?? 0,
      latencyMs: invocation?.latencyMs ?? 0,
      outcome: invocation ? 'SUCCEEDED' : 'UNAVAILABLE',
    } : item)
  })
}

const mappingJsonSchema = { type: 'object', additionalProperties: false, required: ['headerRowIndex', 'columnMap'], properties: { headerRowIndex: { type: 'integer', minimum: 0, maximum: 19 }, columnMap: { type: 'array', minItems: 6, maxItems: 18, items: { type: 'object', additionalProperties: false, required: ['column', 'field', 'confidence'], properties: { column: { type: 'integer', minimum: 0, maximum: 199 }, field: { type: 'string', enum: TEAM_IMPORT_CANONICAL_FIELDS }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } } } }
const repairJsonSchema = { type: 'object', additionalProperties: false, required: ['repairs'], properties: { repairs: { type: 'array', maxItems: 100, items: { type: 'object', additionalProperties: false, required: ['rowNumber', 'columnLabel', 'field', 'suggestion', 'reason', 'confidence'], properties: { rowNumber: { type: 'integer', minimum: 1 }, columnLabel: { type: 'string', enum: ['Team', 'Corresponding Team Member', 'Additional Member 1', 'Additional Member 2', 'Additional Member 3', 'Additional Member 4'] }, field: { type: 'string', enum: ['teamName', 'teamExternalId', 'firstName', 'lastName', 'email'] }, suggestion: { type: 'string', minLength: 1, maxLength: 320 }, reason: { type: 'string', minLength: 1, maxLength: 240 }, confidence: { type: 'number', minimum: 0, maximum: 1 } } } } } }
const explanationJsonSchema = { type: 'object', additionalProperties: false, required: ['summary', 'nextSteps'], properties: { summary: { type: 'string', minLength: 1, maxLength: 600 }, nextSteps: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', minLength: 1, maxLength: 300 } } } }
export const importAssistStructuredSchemas = { mapping: mappingJsonSchema, repair: repairJsonSchema, explanation: explanationJsonSchema }

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
    const contextFingerprint = importAssistContextFingerprint({ fileHash: actualHash, diagnosticCodes: ['LAYOUT_UNRECOGNIZED'] })
    batch = await prisma.importBatch.create({ data: { uploaderId: args.actor.id, uploaderRole: args.actor.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'ADMIN', seasonId: args.seasonId, universityId: args.actor.role === 'SUPERVISOR' ? args.actor.universityId : null, fileName: args.fileName, fileHash: actualHash, status: 'PREVIEWED', summaryJson: json({ assist: { suggestions: [], contextFingerprint } }) } })
    const s3Key = await archiveImportFile({ seasonId: args.seasonId, batchId: batch.id, fileName: args.fileName, fileBuffer: args.fileBuffer })
    if (s3Key) await prisma.importBatch.update({ where: { id: batch.id }, data: { s3Key } })
  }
  const contextFingerprint = importAssistContextFingerprint({ fileHash: actualHash, diagnosticCodes: ['LAYOUT_UNRECOGNIZED'] })
  const stored = (batch.summaryJson as AssistSummary | null)?.assist
  const reusable = stored?.suggestions?.find((item) => item.useCase === 'LAYOUT' && item.contextFingerprint === contextFingerprint && item.outcome === 'PENDING')
  if (reusable) return { batchId: batch.id, fileHash: actualHash, available: true as const, suggestion: reusable, mapping: columnMappingSchema.parse(JSON.parse(reusable.suggestion)) }
  const invocationId = await beginInvocation(batch.id, 'LAYOUT', contextFingerprint, ['LAYOUT_UNRECOGNIZED'])
  const invocation = await invokeImportAssist({ system: 'Map this roster header to the supplied canonical fields. Never invent workbook content.', input: { rows: grid.slice(0, 10), canonicalFields: TEAM_IMPORT_CANONICAL_FIELDS }, schema: columnMappingSchema, jsonSchema: mappingJsonSchema, schemaName: 'roster_column_mapping' })
  await finishInvocation(batch.id, invocationId, invocation)
  if (!invocation) return { batchId: batch.id, fileHash: actualHash, available: false as const }
  const mapping = invocation.data
  const base = { useCase: 'LAYOUT' as const, suggestion: JSON.stringify(mapping), reason: 'Suggested workbook header mapping', confidence: mapping.columnMap.reduce((sum, item) => sum + item.confidence, 0) / mapping.columnMap.length, contextFingerprint }
  const suggestion = { ...base, id: suggestionId(base), outcome: 'PENDING' as const }
  await appendSuggestions(batch.id, [suggestion])
  return { batchId: batch.id, fileHash: actualHash, available: true as const, suggestion, mapping }
}

export async function suggestRosterRepairs(args: { actor: Actor; seasonId: string; batchId: string; fileHash: string; fileName: string; fileBuffer: Buffer; columnMapping?: TeamImportColumnMapping | null; overrides: TeamImportOverride[]; excludedRowNumbers?: number[] }) {
  const batch = await getBatch({ actor: args.actor, batchId: args.batchId, seasonId: args.seasonId, fileBuffer: args.fileBuffer, fileHash: args.fileHash })
  const parsed = applyTeamImportOverrides(await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer, columnMapping: args.columnMapping }), args.overrides)
  const excluded = new Set(args.excludedRowNumbers ?? []); parsed.rows = parsed.rows.filter((row) => !excluded.has(row.rowNumber))
  const validation = await validateTeamImport({ seasonId: args.seasonId, parsedFile: parsed, mode: args.actor.role === 'SUPERVISOR' ? 'supervisor' : 'admin', actor: { id: args.actor.id, email: args.actor.email, universityId: args.actor.universityId } })
  const eligible = validation.rows.flatMap((row) => {
    const issues = row.diagnostics.filter((issue) => issue.aiPolicy === 'SUGGEST_EDIT')
    const team = issues.filter((issue) => issue.target?.columnLabel === 'Team').length ? [{ rowNumber: row.rowNumber, columnLabel: 'Team', teamName: row.teamName, teamExternalId: row.teamExternalId, diagnostics: issues.filter((issue) => issue.target?.columnLabel === 'Team').map((issue) => issue.code) }] : []
    const people = [row.submitter, ...row.members].filter((person) => issues.some((issue) => issue.provenance === person.provenance)).map((person) => ({ rowNumber: row.rowNumber, columnLabel: person.provenance.split(' · ')[1], firstName: person.firstName, lastName: person.lastName, email: person.email, diagnostics: issues.filter((issue) => issue.provenance === person.provenance).map((issue) => issue.code) }))
    return [...team, ...people]
  })
  if (!eligible.length) throw new ApiError('No eligible person issues need assistance', 422, 'INVALID_INPUT')
  const diagnosticCodes = Array.from(new Set(eligible.flatMap((item) => item.diagnostics)))
  const contextFingerprint = importAssistContextFingerprint({ fileHash: args.fileHash, columnMapping: args.columnMapping, overrides: args.overrides, excludedRowNumbers: args.excludedRowNumbers, diagnosticCodes })
  const stored = (await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id }, select: { summaryJson: true } })).summaryJson as AssistSummary
  const reusable = stored.assist?.suggestions?.filter((item) => item.useCase === 'REPAIR' && item.contextFingerprint === contextFingerprint && item.outcome === 'PENDING') ?? []
  if (reusable.length) return { batchId: batch.id, available: true as const, suggestions: reusable }
  const invocationId = await beginInvocation(batch.id, 'REPAIR', contextFingerprint, diagnosticCodes)
  const invocation = await invokeImportAssist({ system: 'Suggest conservative corrections only for the supplied invalid roster fields. Never invent identity or institution data.', input: { fields: eligible }, schema: repairOutputSchema, jsonSchema: repairJsonSchema, schemaName: 'roster_field_repairs' })
  await finishInvocation(batch.id, invocationId, invocation)
  if (!invocation) return { batchId: batch.id, available: false as const, suggestions: [] }
  const output = invocation.data
  const allowed = new Set(eligible.map((item) => `${item.rowNumber}:${item.columnLabel}`))
  const sourceValues = new Map(eligible.flatMap((item) => {
    if ('teamName' in item) return [[`${item.rowNumber}:Team:teamName`, item.teamName], [`${item.rowNumber}:Team:teamExternalId`, item.teamExternalId]]
    return [[`${item.rowNumber}:${item.columnLabel}:firstName`, item.firstName], [`${item.rowNumber}:${item.columnLabel}:lastName`, item.lastName], [`${item.rowNumber}:${item.columnLabel}:email`, item.email]]
  }))
  const suggestions = output.repairs.filter((item) => allowed.has(`${item.rowNumber}:${item.columnLabel}`)).map((item) => {
    const base = { useCase: 'REPAIR' as const, ...item, contextFingerprint, sourceValue: sourceValues.get(`${item.rowNumber}:${item.columnLabel}:${item.field}`) ?? '' }
    return { ...base, id: suggestionId(base), outcome: 'PENDING' as const }
  })
  await appendSuggestions(batch.id, suggestions)
  return { batchId: batch.id, available: true as const, suggestions }
}

export async function explainRosterIssues(args: Parameters<typeof suggestRosterRepairs>[0]) {
  const batch = await getBatch({ actor: args.actor, batchId: args.batchId, seasonId: args.seasonId, fileBuffer: args.fileBuffer, fileHash: args.fileHash })
  const parsed = applyTeamImportOverrides(await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer, columnMapping: args.columnMapping }), args.overrides)
  const excluded = new Set(args.excludedRowNumbers ?? []); parsed.rows = parsed.rows.filter((row) => !excluded.has(row.rowNumber))
  const validation = await validateTeamImport({ seasonId: args.seasonId, parsedFile: parsed, mode: args.actor.role === 'SUPERVISOR' ? 'supervisor' : 'admin', actor: { id: args.actor.id, email: args.actor.email, universityId: args.actor.universityId } })
  const diagnostics = validation.rows.flatMap((row) => row.diagnostics).filter((item) => item.aiPolicy !== 'NEVER').map((item) => ({ code: item.code, severity: item.severity, scope: item.scope, provenance: item.provenance, title: item.title, resolution: item.resolution }))
  if (!diagnostics.length) throw new ApiError('There are no eligible issues to explain', 422, 'INVALID_INPUT')
  const diagnosticCodes = Array.from(new Set(diagnostics.map((item) => item.code)))
  const contextFingerprint = importAssistContextFingerprint({ fileHash: args.fileHash, columnMapping: args.columnMapping, overrides: args.overrides, excludedRowNumbers: args.excludedRowNumbers, diagnosticCodes })
  const stored = (await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id }, select: { summaryJson: true } })).summaryJson as AssistSummary
  const reusable = stored.assist?.explanations?.find((item) => item.contextFingerprint === contextFingerprint)
  if (reusable) return { batchId: batch.id, available: true as const, explanation: { summary: reusable.summary, nextSteps: reusable.nextSteps } }
  const invocationId = await beginInvocation(batch.id, 'EXPLAIN', contextFingerprint, diagnosticCodes)
  const invocation = await invokeImportAssist({ system: 'Explain the supplied RevME validation diagnostics in concise plain English. Do not infer missing workbook data. Give ordered actions.', input: { diagnostics }, schema: explanationOutputSchema, jsonSchema: explanationJsonSchema, schemaName: 'roster_issue_explanation' })
  await finishInvocation(batch.id, invocationId, invocation)
  if (!invocation) return { batchId: batch.id, available: false as const }
  await mutateAssistSummary(batch.id, (_summary, assist) => {
    assist.explanations = [...(assist.explanations ?? []).filter((item) => item.contextFingerprint !== contextFingerprint), { contextFingerprint, ...invocation.data }]
  })
  return { batchId: batch.id, available: true as const, explanation: invocation.data }
}

export async function recordRosterAssistOutcome(args: { actor: Actor; seasonId: string; batchId: string; suggestionId: string; outcome: 'ACCEPTED' | 'REJECTED' }) {
  const batch = await getBatch({ actor: args.actor, batchId: args.batchId, seasonId: args.seasonId })
  const summary = (batch.summaryJson ?? {}) as AssistSummary
  const suggestions = summary.assist?.suggestions ?? []
  const current = suggestions.find((item) => item.id === args.suggestionId)
  if (!current) throw new ApiError('Assist suggestion not found', 404, 'NOT_FOUND')
  if (!current.contextFingerprint || current.contextFingerprint !== summary.assist?.contextFingerprint) throw new ApiError('This AI suggestion is stale. Re-check the roster and request fresh help.', 409, 'CONFLICT')
  if (current.outcome === args.outcome) return { recorded: true as const }
  await mutateAssistSummary(batch.id, (_latestSummary, assist) => {
    if (assist.contextFingerprint !== current.contextFingerprint) throw new ApiError('This AI suggestion is stale. Re-check the roster and request fresh help.', 409, 'CONFLICT')
    assist.suggestions = (assist.suggestions ?? []).map((item) => item.id === args.suggestionId ? { ...item, outcome: args.outcome } : item)
  })
  emitImportAssistOutcomeMetric(args.outcome)
  return { recorded: true as const }
}
