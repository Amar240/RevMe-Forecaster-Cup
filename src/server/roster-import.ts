import crypto from 'crypto'
import type { Prisma, User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { getTeamImportHeaderCoverage, parseTeamImportFile, readTeamImportGrid } from '@/lib/team-import/parser'
import { validateTeamImport } from '@/lib/team-import/validate'
import { importValidatedTeams } from '@/lib/team-import/import'
import { archiveImportFile } from '@/lib/import-archive'
import type { TeamImportConfirmResult } from '@/lib/team-import/types'
import type { TeamImportColumnMapping, TeamImportOverride } from '@/lib/team-import/types'
import { applyTeamImportOverrides } from '@/lib/team-import/overrides'
import { isImportAssistEnabled } from '@/server/import-assist'

type ImportActor = Pick<User, 'id' | 'email' | 'role' | 'universityId' | 'isActive' | 'hasFullAccess'>

function fileHash(buffer: Buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function getSupervisorImportSeason(actor: ImportActor) {
  if (actor.role !== 'SUPERVISOR') throw new ApiError('Supervisor access required', 403, 'FORBIDDEN')
  if (!actor.universityId) throw new ApiError('Supervisor must belong to a university', 422, 'INVALID_INPUT')
  const season = await getCurrentOperationalSeason({ select: { id: true, name: true, status: true, registrationOpen: true } })
  if (!season) throw new ApiError('No operational season is available', 422, 'INVALID_INPUT')
  if (!season.registrationOpen) throw new ApiError('Team registration is not open', 422, 'INVALID_INPUT')
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
}) {
  const hash = fileHash(args.fileBuffer)
  const overrides = args.overrides ?? []
  let existingBatch = args.batchId ? await prisma.importBatch.findUnique({ where: { id: args.batchId } }) : null
  if (args.batchId && !existingBatch) throw new ApiError('Preview batch not found', 404, 'NOT_FOUND')
  if (existingBatch) {
    if (existingBatch.uploaderId !== args.actor.id) throw new ApiError('Import batch does not belong to this user', 403, 'FORBIDDEN')
    if (existingBatch.seasonId !== args.seasonId || existingBatch.uploaderRole !== (args.mode === 'supervisor' ? 'SUPERVISOR' : 'ADMIN')) throw new ApiError('Import batch does not match this request', 409, 'CONFLICT')
    if (existingBatch.status !== 'PREVIEWED') throw new ApiError('Only previewed batches can be re-checked', 409, 'CONFLICT')
    if (!args.submittedFileHash || args.submittedFileHash !== hash || existingBatch.fileHash !== hash) throw new ApiError('Workbook has changed since preview; preview it again', 409, 'CONFLICT')
  }
  const parsedFile = applyTeamImportOverrides(await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer, columnMapping: args.columnMapping }), overrides)
  const validation = await validateTeamImport({
    seasonId: args.seasonId,
    parsedFile,
    mode: args.mode,
    actor: { id: args.actor.id, email: args.actor.email, universityId: args.actor.universityId },
  })
  const previous = existingBatch?.summaryJson as { assist?: unknown } | undefined
  const summaryJson = jsonValue({ metadata: validation.metadata, fileWarnings: validation.fileWarnings, preview: { summary: validation.summary, rows: validation.rows }, overrides, columnMapping: args.columnMapping ?? null, ...(previous?.assist ? { assist: previous.assist } : {}) })
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
  return {
    batchId: batch.id,
    fileHash: hash,
    overrides,
    fileName: args.fileName,
    season: validation.season,
    metadata: validation.metadata,
    fileWarnings: validation.fileWarnings,
    summary: validation.summary,
    rows: validation.rows,
    ...(isImportAssistEnabled() ? { assist: { layoutEligible: !args.columnMapping && getTeamImportHeaderCoverage(readTeamImportGrid({ fileName: args.fileName, fileBuffer: args.fileBuffer })) < 0.8 } } : {}),
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
  const stored = batch.summaryJson as { result?: TeamImportConfirmResult; overrides?: TeamImportOverride[]; columnMapping?: TeamImportColumnMapping | null }
  if (args.mode === 'supervisor' && JSON.stringify(stored.columnMapping ?? null) !== JSON.stringify(args.columnMapping ?? null)) throw new ApiError('Confirmed import mapping does not match the latest preview', 409, 'CONFLICT')
  if ((batch.status === 'CONFIRMED' || batch.status === 'COMPLETED') && stored.result) {
    if (JSON.stringify(stored.overrides ?? []) !== JSON.stringify(overrides)) throw new ApiError('Confirmed import overrides do not match', 409, 'CONFLICT')
    return stored.result
  }

  const parsedFile = applyTeamImportOverrides(await parseTeamImportFile({ fileName: args.fileName, fileBuffer: args.fileBuffer, columnMapping: args.columnMapping }), overrides)
  const validation = await validateTeamImport({
    seasonId: args.seasonId,
    parsedFile,
    mode: args.mode,
    actor: { id: args.actor.id, email: args.actor.email, universityId: args.actor.universityId },
  })
  if (validation.validRows.length === 0) throw new ApiError('No valid rows are available to import', 422, 'INVALID_INPUT', { summary: validation.summary, rows: validation.rows })

  const result = await importValidatedTeams({ actor: args.actor, batchId: batch.id, fileName: args.fileName, mode: args.mode, validation, overrides, columnMapping: args.columnMapping })
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
  await getSupervisorImportSeason(actor)
  return prisma.importBatch.findMany({
    where: { uploaderId: actor.id, uploaderRole: 'SUPERVISOR' },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, fileName: true, status: true, createdAt: true, summaryJson: true, season: { select: { id: true, name: true } } },
  })
}
