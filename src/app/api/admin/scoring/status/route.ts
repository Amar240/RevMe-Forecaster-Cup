import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: { where: { isActive: true } },
      },
    })

    if (!activeSeason) {
      return NextResponse.json({
        seasonName: '',
        rounds: [],
        recentRuns: [],
      })
    }

    const activeTeamsCount = await prisma.team.count({
      where: { 
        seasonId: activeSeason.id, 
        status: 'ACTIVE' 
      },
    })

    const marketCount = activeSeason.markets.length

    const roundStatuses = await Promise.all(
      activeSeason.rounds.map(async (round) => {
        const expectedWeekOffsets = round.isFinal ? 1 : 2
        const expectedActuals = marketCount * 2 * expectedWeekOffsets

        const actualsCount = await prisma.actual.count({
          where: {
            seasonId: activeSeason.id,
            roundId: round.id,
            isVoided: false,
          },
        })

        const submissionsCount = await prisma.submission.count({
          where: { roundId: round.id },
        })

        const teamsWithSubmissions = await prisma.submission.groupBy({
          by: ['teamId'],
          where: { roundId: round.id },
        })

        const aggregatesExist = await prisma.scoreAggregate.count({
          where: {
            seasonId: activeSeason.id,
            roundId: round.id,
          },
        })

        return {
          id: round.id,
          number: round.number,
          isFinal: round.isFinal,
          opensAt: round.opensAt.toISOString(),
          closesAt: round.closesAt.toISOString(),
          actualsCount,
          expectedActuals,
          submissionCount: submissionsCount,
          teamsWithSubmissions: teamsWithSubmissions.length,
          totalActiveTeams: activeTeamsCount,
          scoringComplete: aggregatesExist > 0 && actualsCount === expectedActuals,
          isLockedActuals: round.isLockedActuals,
          scoresStale: round.scoresStale,
          lastScoredAt: round.lastScoredAt?.toISOString() || null,
          actualsVersion: round.actualsVersion,
        }
      })
    )

    const recentRuns = await prisma.scoringRun.findMany({
      where: { seasonId: activeSeason.id },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        triggeredByAdmin: { select: { email: true } },
      },
    })

    const formattedRuns = recentRuns.map((run) => ({
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      completedAt: run.finishedAt?.toISOString() || null,
      status: run.status,
      scope: run.scope,
      roundId: run.roundId,
      adminEmail: run.triggeredByAdmin.email,
      errorsProcessed: run.errorsUpserted,
      aggregatesProcessed: run.aggregatesUpserted,
      actualsVersionAtRun: run.actualsVersionAtRun,
      summaryJson: run.summaryJson,
    }))

    const hasStaleScores = activeSeason.rounds.some(r => r.scoresStale)

    return NextResponse.json({
      seasonName: activeSeason.name,
      rounds: roundStatuses,
      recentRuns: formattedRuns,
      hasStaleScores,
    })
  } catch (error) {
    console.error('Get scoring status error:', error)
    return NextResponse.json({ message: 'Failed to get scoring status' }, { status: 500 })
  }
}
