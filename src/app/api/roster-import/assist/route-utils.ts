import type { User } from '@prisma/client'
import { ApiError, jsonError } from '@/server/http'
import { getSupervisorImportSeason } from '@/server/roster-import'
import { isImportAssistEnabled } from '@/server/import-assist'
import { prisma } from '@/lib/db'

export function requireImportAssistEnabled() { if (!isImportAssistEnabled()) throw new ApiError('Not found', 404, 'NOT_FOUND') }
export async function importAssistSeason(user: User, submittedSeasonId?: string | null) {
  if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN') throw new ApiError('Import assist access required', 403, 'FORBIDDEN')
  const seasonId = user.role === 'SUPERVISOR' ? (await getSupervisorImportSeason(user)).id : submittedSeasonId
  if (!seasonId) throw new ApiError('Season is required', 400, 'INVALID_INPUT')
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true, importAssistMode: true } })
  if (!season) throw new ApiError('Season not found', 404, 'NOT_FOUND')
  if (season.importAssistMode !== 'ON_DEMAND') throw new ApiError('Not found', 404, 'NOT_FOUND')
  return seasonId
}
export function importAssistJsonError(error: unknown, fallback: string) {
  const response = jsonError(error, fallback)
  if (error instanceof ApiError && error.code === 'AI_ASSIST_COOLDOWN') {
    const retryAfterSeconds = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds
    if (retryAfterSeconds) response.headers.set('Retry-After', String(retryAfterSeconds))
  }
  return response
}
