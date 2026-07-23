import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { getAdminTeamScope, getSeasonTeamWhere } from '@/server/team-scope'
import { getRoundRunbook } from '@/server/round-runbook'

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

    const operationalSeason = await getCurrentOperationalSeason({
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
    const teamScope = await getAdminTeamScope({ seasonId: operationalSeason?.id })

    const now = new Date()
    const currentRound = operationalSeason?.rounds.find((r) => {
      const isTimeOpen = new Date(r.closesAt) > now && new Date(r.opensAt) <= now
      const hasStatus = 'status' in r
      const isStatusOpen = !hasStatus || r.status === 'OPEN'
      return isTimeOpen && isStatusOpen
    })

    const [totalUsers, totalSubmissions, totalWarnings, pendingTeamApprovals, runbook] = await Promise.all([
      prisma.user.count(),
      prisma.submission.count(),
      prisma.warning.count(),
      operationalSeason
        ? prisma.team.count({ where: { seasonId: operationalSeason.id, status: 'PENDING_APPROVAL' } })
        : Promise.resolve(0),
      operationalSeason ? getRoundRunbook(operationalSeason.id, now) : Promise.resolve([]),
    ])

    // Warning breakdown for disqualification risk card
    const teamWarningCounts = await prisma.warning.groupBy({
      by: ['teamId'],
      _count: { id: true },
      where: operationalSeason ? { team: getSeasonTeamWhere(operationalSeason.id) } : {},
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

    const activeMarketCount = operationalSeason?.markets?.length ?? 0
    const expectedErrors =
      weekOffsets.length > 0
        ? teamScope.summary.activeTeams * activeMarketCount * 2 * weekOffsets.length
        : null

    const rounds = await Promise.all(
      (operationalSeason?.rounds || []).map(async (round) => {
        const expectedWeekOffsets = round.isFinal ? 1 : 2
        const expectedActuals = activeMarketCount * 2 * expectedWeekOffsets
        const [actualsCount, aggregatesExist] = await Promise.all([
          prisma.actual.count({ where: { roundId: round.id, isVoided: false } }),
          prisma.scoreAggregate.count({ where: { seasonId: operationalSeason!.id, roundId: round.id } }),
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
      activeSeason: operationalSeason
        ? { id: operationalSeason.id, name: operationalSeason.name, status: operationalSeason.status }
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
        totalTeams: teamScope.totalTeams,
        activeTeams: teamScope.summary.activeTeams,
        disqualifiedTeams: teamScope.summary.disqualifiedTeams,
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
        pending: teamScope.summary.activeTeams - currentRoundSubmissions,
        total: teamScope.summary.activeTeams,
      },
      rounds,
      runbook,
    })
  } catch (error) {
    return jsonError(error, 'Failed to load command center')
  }
}
