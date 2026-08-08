import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { buildAuditLogData } from '@/lib/audit'
import { closeOpenSupervisorAssignment } from '@/server/team-supervisor-assignment'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await request.json()
    const reason = body.reason || 'Admin decision'

    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) throw new ApiError('Team not found', 404, 'NOT_FOUND')
    if (team.status === 'DISQUALIFIED') throw new ApiError('Team is already disqualified', 400, 'INVALID_INPUT')

    await prisma.$transaction(async (tx) => {
      await tx.team.update({ where: { id }, data: { status: 'DISQUALIFIED', disqualifiedAt: new Date(), disqualifiedReason: reason } })
      await closeOpenSupervisorAssignment({ teamId: id, endedById: user!.id, reason: `Team disqualified: ${reason}`, db: tx })
      await tx.auditLog.create({ data: buildAuditLogData(user!, 'DISQUALIFY_TEAM', 'Team', id, {
        details: { teamName: team.name, reason },
        before: { status: team.status },
        after: { status: 'DISQUALIFIED' },
      }) })
    })

    return jsonOk({ message: 'Team disqualified successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to disqualify team')
  }
}
