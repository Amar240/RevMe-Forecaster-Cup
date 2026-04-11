import type { AdminScoringScope } from '@/lib/scoring-admin'
import { prisma } from '@/lib/db'

export interface ScoringReadinessCheck {
  roundNumber: number
  roundId: string
  isFinal: boolean
  actualsUploaded: number
  actualsExpected: number
  actualsComplete: boolean
  teamsSubmitted: number
  totalActiveTeams: number
  missingTeams: number
  existingWarnings: number
  isScored: boolean
}

export interface ScoringReadinessSummary {
  ready: boolean
  seasonName: string
  activeTeams: number
  marketCount: number
  totalWarningsExpected: number
  teamsAtRiskOfDQ: number
  checks: ScoringReadinessCheck[]
}

function getExpectedActuals(marketCount: number, isFinal: boolean) {
  return marketCount * 2 * (isFinal ? 1 : 2)
}

function joinNaturalLanguage(values: string[]) {
  if (values.length <= 1) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`
}

export function formatIncompleteActualsMessage(checks: Array<Pick<ScoringReadinessCheck, 'roundNumber' | 'actualsUploaded' | 'actualsExpected'>>) {
  const label = checks.length === 1 ? 'Round' : 'Rounds'
  const detail = joinNaturalLanguage(
    checks.map((check) => `${check.roundNumber} (${check.actualsUploaded}/${check.actualsExpected} uploaded)`)
  )

  return `Scoring cannot run until actuals are complete for ${label} ${detail}.`
}

export async function getScoringReadinessSummary(args: {
  seasonId: string
  scope: AdminScoringScope
  roundId?: string
}): Promise<ScoringReadinessSummary | null> {
  const season = await prisma.season.findUnique({
    where: { id: args.seasonId },
    include: {
      rounds: {
        orderBy: { number: 'asc' },
      },
      markets: {
        where: { isActive: true },
        include: { market: true },
      },
    },
  })

  if (!season) {
    return null
  }

  const activeTeams = await prisma.team.count({
    where: { seasonId: season.id, status: 'ACTIVE' },
  })
  const marketCount = season.markets.length
  const now = new Date()

  const roundsToCheck =
    args.scope === 'ROUND'
      ? season.rounds.filter((round) => args.roundId && round.id === args.roundId)
      : season.rounds.filter((round) => new Date(round.closesAt) <= now)

  const checks = await Promise.all(
    roundsToCheck.map(async (round) => {
      const [actualsUploaded, submittedTeams, existingWarnings, aggregatesExist] = await Promise.all([
        prisma.actual.count({
          where: { roundId: round.id, isVoided: false },
        }),
        prisma.submission.findMany({
          where: { roundId: round.id },
          select: { teamId: true },
          distinct: ['teamId'],
        }),
        prisma.warning.count({
          where: { roundId: round.id },
        }),
        prisma.scoreAggregate.count({
          where: { seasonId: season.id, roundId: round.id },
        }),
      ])

      const actualsExpected = getExpectedActuals(marketCount, round.isFinal)

      return {
        roundNumber: round.number,
        roundId: round.id,
        isFinal: round.isFinal,
        actualsUploaded,
        actualsExpected,
        actualsComplete: actualsUploaded >= actualsExpected,
        teamsSubmitted: submittedTeams.length,
        totalActiveTeams: activeTeams,
        missingTeams: activeTeams - submittedTeams.length,
        existingWarnings,
        isScored: aggregatesExist > 0 && actualsUploaded === actualsExpected,
      }
    })
  )

  const totalWarningsExpected = checks.reduce((sum, check) => {
    if (check.missingTeams > 0 && check.existingWarnings === 0) {
      return sum + check.missingTeams
    }
    return sum
  }, 0)

  const teamsNearDQ = await prisma.team.findMany({
    where: { seasonId: season.id, status: 'ACTIVE' },
    include: { _count: { select: { warnings: true } } },
  })

  return {
    ready: checks.every((check) => check.actualsComplete),
    seasonName: season.name,
    activeTeams,
    marketCount,
    totalWarningsExpected,
    teamsAtRiskOfDQ: teamsNearDQ.filter((team) => team._count.warnings >= 2).length,
    checks,
  }
}
