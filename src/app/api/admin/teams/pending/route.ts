import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const pendingTeams = await prisma.team.findMany({
      where: { status: 'PENDING_APPROVAL' },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
        university: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        season: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({ teams: pendingTeams })
  } catch (error) {
    return jsonError(error, 'Failed to fetch pending teams')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json()
    const { teamId, action, reason } = body

    if (!teamId || !action) {
      throw new ApiError('Team ID and action are required', 400, 'INVALID_INPUT')
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    if (!team) throw new ApiError('Team not found', 404, 'NOT_FOUND')
    if (team.status !== 'PENDING_APPROVAL') throw new ApiError('Team is not pending approval', 400, 'INVALID_INPUT')

    if (action === 'approve') {
      await prisma.team.update({ where: { id: teamId }, data: { status: 'ACTIVE', approvedAt: new Date(), approvedById: user!.id } })
      await prisma.auditLog.create({ data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'TEAM_APPROVED', entityType: 'Team', entityId: teamId, details: { teamName: team.name, status: 'ACTIVE' } } })
      return jsonOk({ message: 'Team approved and activated' })
    }

    if (action === 'reject') {
      await prisma.team.update({ where: { id: teamId }, data: { status: 'REJECTED', rejectionReason: reason || 'No reason provided' } })
      await prisma.auditLog.create({ data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'TEAM_REJECTED', entityType: 'Team', entityId: teamId, details: { teamName: team.name, reason } } })
      return jsonOk({ message: 'Team rejected' })
    }

    throw new ApiError('Invalid action', 400, 'INVALID_INPUT')
  } catch (error) {
    return jsonError(error, 'Failed to process team approval')
  }
}
