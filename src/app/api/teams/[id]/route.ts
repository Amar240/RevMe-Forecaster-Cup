import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
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

    return jsonOk({ team })
  } catch (error) {
    return jsonError(error, 'Failed to get team')
  }
}
