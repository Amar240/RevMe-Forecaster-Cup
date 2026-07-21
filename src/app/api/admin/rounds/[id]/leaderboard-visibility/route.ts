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

    await prisma.$transaction(async (tx) => {
      await tx.round.update({ where: { id }, data: { leaderboardVisible: visible } })
      if (visible && !round.leaderboardVisible) {
        const participants = await tx.teamMember.findMany({
          where: { team: { seasonId: round.seasonId, status: { in: ['ACTIVE', 'APPROVED'] } } },
          select: { userId: true },
        })
        const link = `/debriefs/${round.id}`
        const existing = await tx.notification.findMany({ where: { type: 'ROUND_DEBRIEF_READY', link, userId: { in: participants.map((item) => item.userId) } }, select: { userId: true } })
        const notified = new Set(existing.map((item) => item.userId))
        const users = [...new Set(participants.map((item) => item.userId))].filter((userId) => !notified.has(userId))
        if (users.length) await tx.notification.createMany({ data: users.map((userId) => ({ userId, type: 'ROUND_DEBRIEF_READY', title: `Round ${round.number} debrief is ready`, message: 'See what moved the market and what your forecast can teach you.', link })) })
      }
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
