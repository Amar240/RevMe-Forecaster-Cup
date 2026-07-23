import crypto from 'crypto'
import { Prisma, type User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { getTeamImportHeaderCoverage, parseTeamImportFile, readTeamImportGrid } from '@/lib/team-import/parser'
import { validateTeamImport } from '@/lib/team-import/validate'
import { importValidatedTeams } from '@/lib/team-import/import'
import { archiveImportFile } from '@/lib/import-archive'
import type { ParsedTeamImportRow, TeamImportConfirmResult, TeamImportPersonSummary, TeamImportPreviewRow } from '@/lib/team-import/types'
import type { TeamImportColumnMapping, TeamImportOverride } from '@/lib/team-import/types'
import { applyTeamImportOverrides } from '@/lib/team-import/overrides'
import { isImportAssistEnabled } from '@/server/import-assist'
import { logAuditAction } from '@/lib/audit'
import { importErrorDetails } from '@/lib/team-import/diagnostic-catalog'
import { importAssistContextFingerprint } from '@/lib/team-import/assist'

type ImportActor = Pick<User, 'id' | 'email' | 'role' | 'universityId' | 'isActive' | 'hasFullAccess'>

function fileHash(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function excludedPerson(person: ParsedTeamImportRow['submitter']): TeamImportPersonSummary {
  return { email: person.email, firstName: person.firstName, lastName: person.lastName, displayName: `${person.firstName} ${person.lastName}`.trim() || person.email, uploadedName: null, matchedName: null, nameMismatch: false, willBeCreated: false, provenance: person.provenance ?? '' }
}

function excludedPreview(row: ParsedTeamImportRow): TeamImportPreviewRow {
  return { rowNumber: row.rowNumber, format: row.format, teamExternalId: row.teamExternalId, teamName: row.teamName || row.teamExternalId, universityName: row.universityName, supervisorEmail: row.supervisorEmail, supervisorLabel: null, submitterEmail: row.submitter.email, submitter: excludedPerson(row.submitter), members: row.members.map(excludedPerson), memberCount: [row.submitter, ...row.members].filter((person) => person.email).length, valid: false, autoMatchedSupervisor: false, warnings: [], warningCount: 0, errors: [], diagnostics: [], excluded: true }
}

function splitExcludedRows<T extends { rows: ParsedTeamImportRow[] }>(parsedFile: T, excludedRowNumbers: number[]) {
  const known = new Set(parsedFile.rows.map((row) => row.rowNumber))
  const unknown = excludedRowNumbers.filter((row) => !known.has(row))
  if (unknown.length) throw new ApiError(`Excluded row ${unknown.join(', ')} was not found`, 409, 'CONFLICT')
  const excluded = new Set(excludedRowNumbers)
  return { includedFile: { ...parsedFile, rows: parsedFile.rows.filter((row) => !excluded.has(row.rowNumber)) }, excludedRows: parsedFile.rows.filter((row) => excluded.has(row.rowNumber)).map(excludedPreview) }
}

export async function getSupervisorImportSeason(actor: ImportActor) {
  if (actor.role !== 'SUPERVISOR') throw new ApiError('Supervisor access required', 403, 'FORBIDDEN', importErrorDetails('AUTH_FORBIDDEN', 'Supervisor access required'))
  if (!actor.universityId) throw new ApiError('Supervisor must belong to a university', 422, 'INVALID_INPUT')
  const season = await getCurrentOperationalSeason({ select: { id: true, name: true, status: true, registrationOpen: true } })
  if (!season) throw new ApiError('No operational season is available', 422, 'INVALID_INPUT', importErrorDetails('SEASON_UNAVAILABLE', 'No operational season is available'))
  if (!season.registrationOpen) throw new ApiError('Team registration is not open', 422, 'INVALID_INPUT', importErrorDetails('SEASON_REGISTRATION_CLOSED', 'Team registration is not open'))
  return season
}

export async function previewRosterImport(args: {
  actor: ImportActor
  mode: 'admin' | 'supervisor'
  seasonId: string
  fileName: string
  fileBuffer: Buffer
  batchId?: string | null
  submittedFileHash?: string | null
  overrides?: TeamImportOverride[]
  columnMapping?: TeamImportColumnMapping | null
  excludedRowNumbers?: number[]
}) {
  const hash = fileHash(args.fileBuffer)
  const overrides = args.overrides ?? []
  let existingBatch = args.batchId ? await prisma.importBatch.findUnique({ where: { id: args.batchId } }) : null
  if (args.batchId && !existingBatch) throw new ApiError('Preview batch not found', 404, 'NOT_FOUND')
  if (existingBatch) {
    if (existingBatch.uploaderId !== args.actor.id) throw new ApiError('Import batch does not belong to this user', 403, 'FORBIDDEN')
    if (existingBatch.seasonId !== args.seasonId || existingBatch.uploaderRole !== (args.mode === 'supervisor' ? 'SUPERVISOR' : 'ADMIN')) throw new ApiError('Import batch does not match this request', 409, 'CONFLICT')
    if (existingBatch.status !== 'PREVIEWED') throw new ApiError('Only previewed batches can be re-checked', 409, 'CONFLICT')
    if (!args.submittedFileHash || args.submittedFileHash !== hash || existingBatch.fileHash !== hash) throw new ApiError('Workbook has changed since preview; preview it again', 409, 'CONFLICT', importErrorDetails('STALE_FILE_HASH', 'Workbook has changed since preview; preview it again'))
  }
  const parsedFile = applyTeamImportOverrides(await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer, columnMapping: args.columnMapping }), overrides)
  const excludedRowNumbers = args.excludedRowNumbers ?? []
  const { includedFile, excludedRows } = splitExcludedRows(parsedFile, excludedRowNumbers)
  const validation = await validateTeamImport({
    seasonId: args.seasonId,
    parsedFile: includedFile,
    mode: args.mode,
    actor: { id: args.actor.id, email: args.actor.email, universityId: args.actor.universityId },
  })
  validation.rows = [...validation.rows, ...excludedRows].sort((a, b) => a.rowNumber - b.rowNumber)
  validation.summary = { ...validation.summary, totalRows: validation.summary.totalRows + excludedRows.length, excludedRows: excludedRows.length }
  const previous = existingBatch?.summaryJson as { assist?: { suggestions?: Array<{
    id: string
    outcome?: string
    rowNumber?: number
    columnLabel?: string
    field?: string
    suggestion?: string
    deterministicValidationFailed?: boolean
    [key: string]: unknown
  }>; [key: string]: unknown } } | undefined
  const diagnosticCodes = validation.rows.flatMap((row) => row.diagnostics.map((diagnostic) => diagnostic.code))
  const contextFingerprint = importAssistContextFingerprint({ fileHash: hash, columnMapping: args.columnMapping, overrides, excludedRowNumbers, diagnosticCodes })
  const suggestions = previous?.assist?.suggestions?.map((suggestion) => {
    if (suggestion.outcome !== 'ACCEPTED' || !suggestion.rowNumber || !suggestion.columnLabel || !suggestion.field) return suggestion
    const applied = overrides.some((item) => item.rowNumber === suggestion.rowNumber && item.columnLabel === suggestion.columnLabel && item.field === suggestion.field && item.value === suggestion.suggestion)
    const failed = applied && validation.rows.some((row) => row.rowNumber === suggestion.rowNumber && row.diagnostics.some((diagnostic) =>
      diagnostic.severity === 'ERROR' &&
      diagnostic.target?.columnLabel === suggestion.columnLabel &&
      (diagnostic.target?.field === undefined || diagnostic.target.field === suggestion.field)
    ))
    return failed ? { ...suggestion, deterministicValidationFailed: true } : suggestion
  })
  const previousAssist = { ...(previous?.assist ?? {}), ...(suggestions ? { suggestions } : {}) }
  const summaryJson = jsonValue({
    metadata: validation.metadata,
    fileWarnings: validation.fileWarnings,
    preview: { summary: validation.summary, rows: validation.rows },
    overrides,
    excludedRowNumbers,
    columnMapping: args.columnMapping ?? null,
    assist: { ...previousAssist, contextFingerprint },
  })
  const batch = existingBatch ? await prisma.importBatch.update({ where: { id: existingBatch.id }, data: { summaryJson } }) : await prisma.importBatch.create({
    data: {
      uploaderId: args.actor.id,
      uploaderRole: args.mode === 'supervisor' ? 'SUPERVISOR' : 'ADMIN',
      seasonId: args.seasonId,
      universityId: args.mode === 'supervisor' ? args.actor.universityId : null,
      fileName: args.fileName,
      fileHash: hash,
      status: 'PREVIEWED',
      summaryJson,
    },
  })
  if (!existingBatch) {
    const s3Key = await archiveImportFile({ seasonId: args.seasonId, batchId: batch.id, fileName: args.fileName, fileBuffer: args.fileBuffer })
    if (s3Key) await prisma.importBatch.update({ where: { id: batch.id }, data: { s3Key } })
  }
  const assistEnabled = isImportAssistEnabled() && (await prisma.season.findUnique({ where: { id: args.seasonId }, select: { importAssistMode: true } }))?.importAssistMode === 'ON_DEMAND'
  return {
    batchId: batch.id,
    fileHash: hash,
    overrides,
    excludedRowNumbers,
    fileName: args.fileName,
    season: validation.season,
    metadata: validation.metadata,
    fileWarnings: validation.fileWarnings,
    summary: validation.summary,
    rows: validation.rows,
    ...(assistEnabled ? { assist: { layoutEligible: !args.columnMapping && getTeamImportHeaderCoverage(readTeamImportGrid({ fileName: args.fileName, fileBuffer: args.fileBuffer })) < 0.8 } } : {}),
  }
}

export async function confirmRosterImport(args: {
  actor: ImportActor
  mode: 'admin' | 'supervisor'
  seasonId: string
  batchId: string | null
  fileName: string
  fileBuffer: Buffer
  submittedFileHash?: string | null
  overrides?: TeamImportOverride[]
  columnMapping?: TeamImportColumnMapping | null
  excludedRowNumbers?: number[]
}) {
  let batch = args.batchId ? await prisma.importBatch.findUnique({ where: { id: args.batchId } }) : null
  if (!batch) {
    if (args.mode === 'supervisor') throw new ApiError('Preview batch not found', 404, 'NOT_FOUND')
    const preview = await previewRosterImport(args)
    batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: preview.batchId } })
  }
  if (batch.uploaderId !== args.actor.id) throw new ApiError('Import batch does not belong to this user', 403, 'FORBIDDEN')
  if (batch.seasonId !== args.seasonId) throw new ApiError('Import batch season does not match', 409, 'CONFLICT')
  if (batch.uploaderRole !== (args.mode === 'supervisor' ? 'SUPERVISOR' : 'ADMIN')) throw new ApiError('Import batch mode does not match', 409, 'CONFLICT')
  const hash = fileHash(args.fileBuffer)
  if (args.mode === 'supervisor' && !args.submittedFileHash) throw new ApiError('File hash is required', 400, 'INVALID_INPUT')
  if ((args.submittedFileHash && args.submittedFileHash !== hash) || batch.fileHash !== hash) throw new ApiError('Workbook has changed since preview; preview it again', 409, 'CONFLICT')

  const overrides = args.overrides ?? []
  const excludedRowNumbers = args.excludedRowNumbers ?? []
  const stored = batch.summaryJson as { result?: TeamImportConfirmResult; overrides?: TeamImportOverride[]; excludedRowNumbers?: number[]; columnMapping?: TeamImportColumnMapping | null }
  if (args.mode === 'supervisor' && JSON.stringify(stored.columnMapping ?? null) !== JSON.stringify(args.columnMapping ?? null)) throw new ApiError('Confirmed import mapping does not match the latest preview', 409, 'CONFLICT')
  if (args.mode === 'supervisor' && JSON.stringify(stored.overrides ?? []) !== JSON.stringify(overrides)) throw new ApiError('Confirmed import overrides do not match the latest preview', 409, 'CONFLICT')
  if (args.mode === 'supervisor' && JSON.stringify(stored.excludedRowNumbers ?? []) !== JSON.stringify(excludedRowNumbers)) throw new ApiError('Confirmed import exclusions do not match the latest preview', 409, 'CONFLICT')
  if ((batch.status === 'CONFIRMED' || batch.status === 'COMPLETED') && stored.result) {
    if (JSON.stringify(stored.overrides ?? []) !== JSON.stringify(overrides)) throw new ApiError('Confirmed import overrides do not match', 409, 'CONFLICT')
    if (JSON.stringify(stored.excludedRowNumbers ?? []) !== JSON.stringify(excludedRowNumbers)) throw new ApiError('Confirmed import exclusions do not match', 409, 'CONFLICT')
    return stored.result
  }

  const parsedFile = applyTeamImportOverrides(await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer, columnMapping: args.columnMapping }), overrides)
  const { includedFile, excludedRows } = splitExcludedRows(parsedFile, excludedRowNumbers)
  const validation = await validateTeamImport({
    seasonId: args.seasonId,
    parsedFile: includedFile,
    mode: args.mode,
    actor: { id: args.actor.id, email: args.actor.email, universityId: args.actor.universityId },
  })
  validation.rows = [...validation.rows, ...excludedRows].sort((a, b) => a.rowNumber - b.rowNumber)
  validation.summary = { ...validation.summary, totalRows: validation.summary.totalRows + excludedRows.length, excludedRows: excludedRows.length }
  if (validation.validRows.length === 0) throw new ApiError('No valid rows are available to import', 422, 'INVALID_INPUT', { summary: validation.summary, rows: validation.rows })

  const result = await importValidatedTeams({ actor: args.actor, batchId: batch.id, fileName: args.fileName, mode: args.mode, validation, overrides, excludedRowNumbers, columnMapping: args.columnMapping })
  if (args.mode === 'supervisor') {
    const recipients = await prisma.user.findMany({
      where: { isActive: true, OR: [{ role: 'ADMIN' }, { role: 'SUB_ADMIN', hasFullAccess: true }] },
      select: { id: true },
    })
    if (recipients.length) {
      const university = await prisma.university.findUnique({ where: { id: args.actor.universityId! }, select: { name: true } })
      await prisma.notification.createMany({ data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: 'ROSTER_IMPORT_PENDING',
        title: `${university?.name ?? 'University'}: ${result.summary.teamsCreated} teams awaiting approval`,
        message: `Roster uploaded by ${args.actor.email}`,
        link: '/admin/team-approvals',
      })) })
    }
  }
  return result
}

export async function getSupervisorImportHistory(actor: ImportActor) {
  if (actor.role !== 'SUPERVISOR') throw new ApiError('Supervisor access required', 403, 'FORBIDDEN')
  return prisma.importBatch.findMany({
    where: { uploaderId: actor.id, uploaderRole: 'SUPERVISOR' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, fileName: true, status: true, createdAt: true, summaryJson: true, season: { select: { id: true, name: true } }, teams: { orderBy: { createdAt: 'asc' }, select: { id: true, name: true, externalTeamId: true, status: true } } },
  })
}

export async function withdrawSupervisorImportedTeam(actor: ImportActor, teamId: string, reason?: string) {
  if (actor.role !== 'SUPERVISOR') throw new ApiError('Supervisor access required', 403, 'FORBIDDEN')
  const trimmedReason = reason?.trim() || 'Imported in error'
  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({ where: { id: teamId }, include: { importBatch: true } })
    if (!team || !team.importBatch) throw new ApiError('Imported team not found', 404, 'NOT_FOUND')
    if (team.supervisorId !== actor.id || team.importBatch.uploaderId !== actor.id || team.importBatch.uploaderRole !== 'SUPERVISOR') throw new ApiError('Imported team does not belong to this supervisor', 403, 'FORBIDDEN')
    if (team.status !== 'PENDING_APPROVAL') throw new ApiError('Only teams awaiting approval can be withdrawn', 409, 'CONFLICT')
    await tx.team.update({ where: { id: team.id }, data: { status: 'REJECTED', rejectionReason: `Withdrawn by supervisor: ${trimmedReason}` } })
    const remaining = await tx.team.count({ where: { importBatchId: team.importBatch.id, status: 'PENDING_APPROVAL', id: { not: team.id } } })
    const summary = (team.importBatch.summaryJson ?? {}) as Record<string, unknown>
    const withdrawals = Array.isArray(summary.withdrawals) ? summary.withdrawals : []
    await tx.importBatch.update({ where: { id: team.importBatch.id }, data: { status: remaining === 0 ? 'COMPLETED' : 'CONFIRMED', summaryJson: jsonValue({ ...summary, withdrawals: [...withdrawals, { teamId: team.id, actorId: actor.id, reason: trimmedReason, withdrawnAt: new Date().toISOString() }] }) } })
    return { teamId: team.id, batchId: team.importBatch.id, teamName: team.name, remaining }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  await logAuditAction(actor.id, 'IMPORTED_TEAM_WITHDRAWN', 'Team', result.teamId, { batchId: result.batchId, teamName: result.teamName, reason: trimmedReason })
  return { message: 'Team withdrawn from approval' }
}
