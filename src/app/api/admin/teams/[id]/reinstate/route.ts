import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { buildAuditLogData } from '@/lib/audit'
import { createInitialSupervisorAssignment } from '@/server/team-supervisor-assignment'
import { countSupervisorTeamsInSeason } from '@/server/team-membership'
import { sameUniversity } from '@/server/universities'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const team = await prisma.team.findUnique({ where: { id }, include: { university: true, season: true, supervisor: { include: { university: true } } } })
    if (!team) throw new ApiError('Team not found', 404, 'NOT_FOUND')
    if (team.status === 'ACTIVE') throw new ApiError('Team is already active', 400, 'INVALID_INPUT')

    await prisma.$transaction(async (tx) => {
      let supervisorId = team.supervisorId
      if (!team.supervisor || !team.supervisor.isActive || !sameUniversity(team.university, team.supervisor.university) || team.season?.status === 'COMPLETED') {
        supervisorId = null
      }
      if (supervisorId) {
        const count = await countSupervisorTeamsInSeason({ supervisorId, seasonId: team.seasonId, excludeTeamId: team.id, db: tx })
        if (count >= 10) supervisorId = null
      }
      await tx.team.update({ where: { id }, data: { status: 'ACTIVE', supervisorId, disqualifiedAt: null, disqualifiedReason: null } })
      await createInitialSupervisorAssignment({ teamId: id, supervisorId, assignedById: user!.id, reason: 'Assignment restored after reinstatement', source: 'RESTORED', db: tx })
      await tx.auditLog.create({ data: buildAuditLogData(user!, 'REINSTATE_TEAM', 'Team', id, {
        details: { teamName: team.name, supervisorRestored: Boolean(supervisorId) },
        before: { status: team.status, supervisorId: team.supervisorId },
        after: { status: 'ACTIVE', supervisorId },
      }) })
    })

    return jsonOk({ message: 'Team reinstated successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to reinstate team')
  }
}
