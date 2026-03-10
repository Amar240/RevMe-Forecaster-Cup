import { NextRequest } from 'next/server'
import { runScoring } from '@/lib/scoring'
import { prisma } from '@/lib/db'
import { logAuditAction } from '@/lib/audit'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

async function notifyLeaderboardRelease(seasonId: string, roundId?: string) {
  const roundInfo = roundId
    ? await prisma.round.findUnique({ where: { id: roundId }, select: { number: true } })
    : null

  const title = roundInfo ? `Round ${roundInfo.number} Leaderboard Released` : 'Season Leaderboard Updated'
  const message = roundInfo
    ? `Scores for Round ${roundInfo.number} have been calculated. Check the leaderboard to see where your team ranks!`
    : 'Season leaderboard has been updated with the latest scores. Check your rankings!'

  const usersToNotify = await prisma.user.findMany({
    where: {
      role: { in: ['STUDENT', 'SUPERVISOR'] },
      OR: [
        { teamMemberships: { some: { team: { seasonId } } } },
        { supervisedTeams: { some: { seasonId } } },
      ],
    },
    select: { id: true },
  })

  if (usersToNotify.length > 0) {
    await prisma.notification.createMany({
      data: usersToNotify.map((u) => ({ userId: u.id, type: 'LEADERBOARD_RELEASE', title, message, link: '/leaderboards' })),
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse('scoring:run')
    if (response) return response

    const body = await request.json()
    const { seasonId, scope = 'SEASON', roundId } = body

    let targetSeasonId = seasonId
    if (!targetSeasonId) {
      const activeSeason = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
      if (!activeSeason) throw new ApiError('No active season found', 400, 'INVALID_INPUT')
      targetSeasonId = activeSeason.id
    }

    const result = await runScoring(targetSeasonId, user!.id, scope, roundId)

    await logAuditAction(user!.id, 'RUN_SCORING', 'Season', targetSeasonId, {
      scope, roundId,
      result: { status: result.status, submissionsProcessed: result.submissionsProcessed, errorsUpserted: result.errorsUpserted, aggregatesUpserted: result.aggregatesUpserted },
    })

    if (result.status === 'FAILED') {
      return jsonOk({ message: `Scoring failed: ${result.errorMessage}`, ...result }, 500)
    }

    await notifyLeaderboardRelease(targetSeasonId, roundId)
    return jsonOk({ message: 'Scoring completed successfully', ...result })
  } catch (error) {
    return jsonError(error, 'Scoring failed')
  }
}
