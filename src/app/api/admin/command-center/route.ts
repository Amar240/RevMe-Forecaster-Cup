import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

function getRoundStatus(opensAt: Date, closesAt: Date): string {
  const now = new Date()
  if (now < opensAt) return 'Upcoming'
  if (now > closesAt) return 'Closed'
  const hoursLeft = (closesAt.getTime() - now.getTime()) / (1000 * 60 * 60)
  if (hoursLeft <= 24) return 'Closing Soon'
  return 'Open'
}

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        rounds: {
          orderBy: { number: 'asc' },
          include: {
            _count: { select: { submissions: true, actuals: true } },
          },
        },
        markets: { where: { isActive: true }, include: { market: true } },
      },
    })

    const now = new Date()
    const currentRound = activeSeason?.rounds.find((r) => {
      const isTimeOpen = new Date(r.closesAt) > now && new Date(r.opensAt) <= now
      const hasStatus = 'status' in r
      const isStatusOpen = !hasStatus || r.status === 'OPEN'
      return isTimeOpen && isStatusOpen
    })

    const seasonFilter = activeSeason ? { seasonId: activeSeason.id } : {}
    const [totalTeams, activeTeams, disqualifiedTeams, totalUsers, totalSubmissions, totalWarnings, pendingTeamApprovals] = await Promise.all([
      prisma.team.count({ where: seasonFilter }),
      prisma.team.count({ where: { ...seasonFilter, status: 'ACTIVE' } }),
      prisma.team.count({ where: { ...seasonFilter, status: 'DISQUALIFIED' } }),
      prisma.user.count(),
      prisma.submission.count(),
      prisma.warning.count(),
      prisma.team.count({ where: { ...seasonFilter, status: 'PENDING_APPROVAL' } }),
    ])

    // Warning breakdown for disqualification risk card
    const teamWarningCounts = await prisma.warning.groupBy({
      by: ['teamId'],
      _count: { id: true },
      where: activeSeason ? { team: { seasonId: activeSeason.id } } : {},
    })
    const oneWarningTeams = teamWarningCounts.filter((w) => w._count.id === 1).length
    const twoWarningTeams = teamWarningCounts.filter((w) => w._count.id === 2).length

    let currentRoundSubmissions = 0
    if (currentRound) {
      const submissions = await prisma.submission.findMany({
        where: { roundId: currentRound.id },
        select: { teamId: true },
        distinct: ['teamId'],
      })
      currentRoundSubmissions = submissions.length
    }

    const scoredSubmissions = await prisma.predictionError.count()

    let weekOffsets: number[] = []
    if (currentRound) {
      const submissionOffsets = await prisma.submissionValue.findMany({
        where: { submission: { roundId: currentRound.id } },
        select: { weekOffset: true },
        distinct: ['weekOffset'],
      })
      const actualOffsets = await prisma.actual.findMany({
        where: { roundId: currentRound.id },
        select: { weekOffset: true },
        distinct: ['weekOffset'],
      })
      weekOffsets = Array.from(
        new Set([...submissionOffsets, ...actualOffsets].map((o) => o.weekOffset))
      ).sort((a, b) => a - b)
    }

    const activeMarketCount = activeSeason?.markets?.length ?? 0
    const expectedErrors =
      weekOffsets.length > 0
        ? activeTeams * activeMarketCount * 2 * weekOffsets.length
        : null

    const rounds = await Promise.all(
      (activeSeason?.rounds || []).map(async (round) => {
        const expectedWeekOffsets = round.isFinal ? 1 : 2
        const expectedActuals = activeMarketCount * 2 * expectedWeekOffsets
        const [actualsCount, aggregatesExist] = await Promise.all([
          prisma.actual.count({ where: { roundId: round.id, isVoided: false } }),
          prisma.scoreAggregate.count({ where: { seasonId: activeSeason!.id, roundId: round.id } }),
        ])
        const hasActuals = actualsCount > 0
        const isScored = aggregatesExist > 0 && actualsCount === expectedActuals
        return {
          id: round.id,
          number: round.number,
          opensAt: round.opensAt.toISOString(),
          closesAt: round.closesAt.toISOString(),
          status: getRoundStatus(new Date(round.opensAt), new Date(round.closesAt)),
          submissionCount: round._count.submissions,
          hasActuals,
          isScored,
        }
      })
    )

    return jsonOk({
      activeSeason: activeSeason
        ? { id: activeSeason.id, name: activeSeason.name, status: activeSeason.status }
        : null,
      currentRound: currentRound
        ? {
            id: currentRound.id,
            number: currentRound.number,
            opensAt: currentRound.opensAt.toISOString(),
            closesAt: currentRound.closesAt.toISOString(),
            status: getRoundStatus(new Date(currentRound.opensAt), new Date(currentRound.closesAt)),
            leaderboardReviewed: currentRound.leaderboardReviewed,
            participantsNotified: currentRound.participantsNotified,
          }
        : null,
      stats: {
        totalTeams,
        activeTeams,
        disqualifiedTeams,
        totalUsers,
        totalSubmissions,
        currentRoundSubmissions,
        totalWarnings,
        teamsWithActuals: rounds.filter((r) => r.hasActuals).length,
        scoredSubmissions,
        oneWarningTeams,
        twoWarningTeams,
      },
      meta: {
        weekOffsets,
        lastScoredAt: currentRound?.lastScoredAt ? currentRound.lastScoredAt.toISOString() : null,
        lastActualsUploadAt: null,
        expectedErrors,
        pendingTeamApprovals,
        activeMarketCount,
      },
      submissionProgress: {
        submitted: currentRoundSubmissions,
        pending: activeTeams - currentRoundSubmissions,
        total: activeTeams,
      },
      rounds,
    })
  } catch (error) {
    return jsonError(error, 'Failed to load command center')
  }
}
