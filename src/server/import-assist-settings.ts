import type { ImportAssistMode, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { IMPORT_ASSIST_MODEL, isImportAssistEnabled } from './import-assist'

type Summary = { assist?: { invocations?: Array<{ inputTokens?: number; outputTokens?: number }>; suggestions?: Array<{ outcome?: string; deterministicValidationFailed?: boolean }> } }

export async function getSeasonImportAssistStatus(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true, importAssistMode: true } })
  if (!season) throw new ApiError('Season not found', 404, 'NOT_FOUND')
  const batches = await prisma.importBatch.findMany({ where: { seasonId }, select: { summaryJson: true } })
  const usage = { calls: 0, inputTokens: 0, outputTokens: 0, accepted: 0, rejected: 0, failedRevalidation: 0 }
  for (const batch of batches) {
    const assist = (batch.summaryJson as Summary | null)?.assist
    for (const invocation of assist?.invocations ?? []) {
      usage.calls += 1
      usage.inputTokens += invocation.inputTokens ?? 0
      usage.outputTokens += invocation.outputTokens ?? 0
    }
    for (const suggestion of assist?.suggestions ?? []) {
      if (suggestion.outcome === 'ACCEPTED') usage.accepted += 1
      if (suggestion.outcome === 'REJECTED') usage.rejected += 1
      if (suggestion.deterministicValidationFailed) usage.failedRevalidation += 1
    }
  }
  const infrastructureAvailable = isImportAssistEnabled()
  return { seasonId, infrastructureAvailable, mode: season.importAssistMode, effective: infrastructureAvailable && season.importAssistMode === 'ON_DEMAND', model: IMPORT_ASSIST_MODEL, usage }
}

export async function setSeasonImportAssistMode(seasonId: string, mode: ImportAssistMode) {
  if (mode === 'ON_DEMAND' && !isImportAssistEnabled()) throw new ApiError('AI assistance cannot be enabled because the deployment master switch is off', 409, 'CONFLICT')
  return prisma.season.update({ where: { id: seasonId }, data: { importAssistMode: mode }, select: { id: true, importAssistMode: true } }).catch((error: Prisma.PrismaClientKnownRequestError) => {
    if (error.code === 'P2025') throw new ApiError('Season not found', 404, 'NOT_FOUND')
    throw error
  })
}
