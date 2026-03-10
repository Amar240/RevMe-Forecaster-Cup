import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const team = await prisma.team.findUnique({ where: { id } })
    if (!team) throw new ApiError('Team not found', 404, 'NOT_FOUND')
    if (team.status === 'ACTIVE') throw new ApiError('Team is already active', 400, 'INVALID_INPUT')

    await prisma.team.update({ where: { id }, data: { status: 'ACTIVE', disqualifiedAt: null, disqualifiedReason: null } })
    await logAuditAction(user!.id, 'REINSTATE_TEAM', 'Team', id, { teamName: team.name })

    return jsonOk({ message: 'Team reinstated successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to reinstate team')
  }
}
