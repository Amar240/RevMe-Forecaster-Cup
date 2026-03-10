import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireAdminOrResponse('scoring:run')
    if (response) return response

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        rounds: { 
          orderBy: { number: 'asc' },
          include: { _count: { select: { submissions: true, actuals: true } } },
        },
        markets: { where: { isActive: true }, include: { market: true } },
      },
    })

    if (!activeSeason) return jsonOk({ ready: false, reason: 'No active season', checks: [] })

    const activeTeams = await prisma.team.count({ where: { status: 'ACTIVE' } })
    const marketCount = activeSeason.markets.length

    const now = new Date()
    const closedRounds = activeSeason.rounds.filter(r => new Date(r.closesAt) <= now)

    const checks = []
    let allReady = true
    let totalWarningsExpected = 0
    let totalDQExpected = 0

    for (const round of closedRounds) {
      const actualsCount = await prisma.actual.count({
        where: { roundId: round.id, isVoided: false },
      })
      const expectedActuals = marketCount * 2 * (round.isFinal ? 1 : 2)
      const actualsComplete = actualsCount >= expectedActuals

      const submissionCount = await prisma.submission.count({
        where: { roundId: round.id },
      })
      const submittedTeamIds = await prisma.submission.findMany({
        where: { roundId: round.id },
        select: { teamId: true },
        distinct: ['teamId'],
      })
      const missingTeams = activeTeams - submittedTeamIds.length

      const existingWarnings = await prisma.warning.count({
        where: { roundId: round.id },
      })

      if (missingTeams > 0 && existingWarnings === 0) {
        totalWarningsExpected += missingTeams
      }

      if (!actualsComplete) allReady = false

      checks.push({
        roundNumber: round.number,
        roundId: round.id,
        isFinal: round.isFinal,
        actualsUploaded: actualsCount,
        actualsExpected: expectedActuals,
        actualsComplete,
        teamsSubmitted: submittedTeamIds.length,
        totalActiveTeams: activeTeams,
        missingTeams,
        existingWarnings,
        isScored: round._count.submissions > 0 && round._count.actuals > 0,
      })
    }

    const teamsNearDQ = await prisma.team.findMany({
      where: { status: 'ACTIVE' },
      include: { _count: { select: { warnings: true } } },
    })
    totalDQExpected = teamsNearDQ.filter(t => t._count.warnings >= 2).length

    return jsonOk({
      ready: allReady,
      reason: allReady ? 'All checks passed' : 'Some rounds have incomplete actuals',
      seasonName: activeSeason.name,
      activeTeams,
      marketCount,
      totalWarningsExpected,
      teamsAtRiskOfDQ: totalDQExpected,
      checks,
    })
  } catch (error) {
    return jsonError(error, 'Failed to run preflight check')
  }
}
