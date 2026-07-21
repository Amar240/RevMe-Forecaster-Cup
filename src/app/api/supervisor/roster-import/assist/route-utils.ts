import type { User } from '@prisma/client'
import { ApiError } from '@/server/http'
import { getSupervisorImportSeason } from '@/server/roster-import'
import { isImportAssistEnabled } from '@/server/import-assist'
import { prisma } from '@/lib/db'

export function requireImportAssistEnabled() { if (!isImportAssistEnabled()) throw new ApiError('Not found', 404, 'NOT_FOUND') }
export async function importAssistSeason(user: User, submittedSeasonId?: string | null) {
  if (user.role === 'SUPERVISOR') return (await getSupervisorImportSeason(user)).id
  if (user.role !== 'ADMIN') throw new ApiError('Import assist access required', 403, 'FORBIDDEN')
  if (!submittedSeasonId) throw new ApiError('Season is required', 400, 'INVALID_INPUT')
  if (!await prisma.season.findUnique({ where: { id: submittedSeasonId }, select: { id: true } })) throw new ApiError('Season not found', 404, 'NOT_FOUND')
  return submittedSeasonId
}
