import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { prisma } from '@/lib/db'
import { logAuditAction } from '@/lib/audit'
import { ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

const schema = z.object({
  visible: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const { visible } = await parseJson(request, schema)

    const round = await prisma.round.findUnique({ where: { id } })
    if (!round) throw new ApiError('Round not found', 404, 'NOT_FOUND')

    await prisma.round.update({
      where: { id },
      data: { leaderboardVisible: visible },
    })

    await logAuditAction(
      user!.id,
      visible ? 'PUBLISH_LEADERBOARD' : 'UNPUBLISH_LEADERBOARD',
      'Round',
      id,
      { roundNumber: round.number, visible },
      null
    )

    return jsonOk({
      message: `Leaderboard for Round ${round.number} is now ${visible ? 'visible' : 'hidden'}`,
    })
  } catch (error) {
    return jsonError(error, 'Failed to update leaderboard visibility')
  }
}
