import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError, parseJson } from '@/server/http'
import { renameTeam } from '@/server/team-roster'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const renameTeamSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { id } = await params

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        university: true,
        supervisor: true,
        members: {
          include: { user: true },
        },
        submissions: {
          include: { round: true, values: true },
          orderBy: { submittedAt: 'desc' },
        },
        warnings: {
          include: { round: true },
        },
      },
    })

    if (!team) {
      throw new ApiError('Team not found', 404, 'NOT_FOUND')
    }

    if (user!.role !== 'ADMIN' && team.supervisorId !== user!.id) {
      const isMember = team.members.some((m) => m.userId === user!.id)
      if (!isMember) {
        throw new ApiError('Forbidden', 403, 'FORBIDDEN')
      }
    }

    const viewerCanManage = user!.role === 'ADMIN' || team.supervisorId === user!.id

    return jsonOk({ team, viewerCanManage })
  } catch (error) {
    return jsonError(error, 'Failed to get team')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR' && user!.role !== 'ADMIN') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const { id } = await params
    const data = await parseJson(request, renameTeamSchema)

    const team = await renameTeam({
      actor: user!,
      access: user!.role === 'ADMIN' ? 'admin' : 'supervisor',
      teamId: id,
      name: data.name,
    })

    return jsonOk({ team })
  } catch (error) {
    return jsonError(error, 'Failed to update team')
  }
}
