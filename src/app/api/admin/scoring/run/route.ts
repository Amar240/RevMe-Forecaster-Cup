import { NextRequest } from 'next/server'
import { runScoring } from '@/lib/scoring'
import { prisma } from '@/lib/db'
import { logAuditAction } from '@/lib/audit'
import { normalizeScoringScope } from '@/lib/scoring-admin'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { formatIncompleteActualsMessage, getScoringReadinessSummary } from '@/server/scoring-readiness'
import { getCurrentOperationalSeason } from '@/server/season'

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
    const { seasonId, roundId } = body
    const scope = normalizeScoringScope(body.scope ?? 'SEASON')

    if (!scope) {
      throw new ApiError('Invalid scoring scope', 400, 'INVALID_INPUT')
    }

    let targetSeasonId = seasonId
    if (!targetSeasonId) {
      const operationalSeason = await getCurrentOperationalSeason({
        select: { id: true },
      })
      if (!operationalSeason) throw new ApiError('No operational season found', 400, 'INVALID_INPUT')
      targetSeasonId = operationalSeason.id
    }

    const readiness = await getScoringReadinessSummary({
      seasonId: targetSeasonId,
      scope,
      roundId,
    })
    const incompleteChecks = readiness?.checks.filter((check) => !check.actualsComplete) ?? []

    if (incompleteChecks.length > 0) {
      throw new ApiError(
        formatIncompleteActualsMessage(incompleteChecks),
        422,
        'INVALID_INPUT',
        {
          rounds: incompleteChecks.map((check) => ({
            roundId: check.roundId,
            roundNumber: check.roundNumber,
            actualsUploaded: check.actualsUploaded,
            actualsExpected: check.actualsExpected,
          })),
        }
      )
    }

    const result = await runScoring(targetSeasonId, user!.id, scope, roundId)

    await logAuditAction(user!.id, 'RUN_SCORING', 'Season', targetSeasonId, {
      scope, roundId,
      result: { status: result.status, submissionsProcessed: result.submissionsProcessed, errorsUpserted: result.errorsUpserted, aggregatesUpserted: result.aggregatesUpserted },
    })

    if (result.status === 'FAILED') {
      return jsonOk({ message: `Scoring failed: ${result.errorMessage}`, ...result }, 500)
    }

    const scoredAt = new Date()
    const scoredRounds = await prisma.round.findMany({
      where: {
        seasonId: targetSeasonId,
        ...(scope === 'ROUND' && roundId ? { id: roundId } : {}),
        actuals: { some: { isVoided: false } },
      },
      select: { id: true },
    })
    if (scoredRounds.length > 0) {
      await prisma.round.updateMany({
        where: { id: { in: scoredRounds.map((round) => round.id) } },
        data: {
          isLockedActuals: true,
          lockedAt: scoredAt,
          lockedById: user!.id,
          scoresStale: false,
          lastScoredAt: scoredAt,
          lastScoredById: user!.id,
        },
      })
    }

    await notifyLeaderboardRelease(targetSeasonId, roundId)
    return jsonOk({ message: 'Scoring completed successfully', ...result })
  } catch (error) {
    return jsonError(error, 'Scoring failed')
  }
}
