import type { Role } from '@prisma/client'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'

export async function resolveScoreTeam(input: { userId: string; role: Role; seasonId: string; requestedTeamId?: string | null }) {
  const { userId, role, seasonId, requestedTeamId } = input
  if (role === 'STUDENT') {
    const membership = await prisma.teamMember.findFirst({ where: { userId, team: { seasonId, ...(requestedTeamId ? { id: requestedTeamId } : {}) } }, select: { team: { select: { id: true, name: true, displayId: true } } } })
    if (requestedTeamId && !membership) throw new ApiError('Team is outside your scope', 403, 'FORBIDDEN')
    return membership?.team ?? null
  }
  if (!requestedTeamId) return null
  const team = await prisma.team.findFirst({ where: { id: requestedTeamId, seasonId, ...(role === 'SUPERVISOR' ? { supervisorId: userId } : {}) }, select: { id: true, name: true, displayId: true } })
  if (!team) throw new ApiError('Team is outside your scope', 403, 'FORBIDDEN')
  return team
}
