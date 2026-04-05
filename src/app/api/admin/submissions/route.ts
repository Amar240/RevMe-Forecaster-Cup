import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason()
    if (!operationalSeason) {
      return jsonOk({ submissions: [], totalSubmissions: 0, scoredSubmissionsCount: 0, uniqueTeamsCount: 0 })
    }

    const submissions = await prisma.submission.findMany({
      where: { round: { seasonId: operationalSeason.id } },
      include: {
        team: true, round: true, submittedBy: true,
        values: { include: { market: true } },
      },
      orderBy: [{ round: { number: 'desc' } }, { submittedAt: 'desc' }],
    })

    const errors = await prisma.predictionError.findMany({
      where: { seasonId: operationalSeason.id },
    })
    const errorMap = new Map<string, number>()
    for (const err of errors) {
      errorMap.set(`${err.teamId}-${err.roundId}-${err.marketId}-${err.metric}-${err.weekOffset}`, err.absError)
    }

    const scoredPairs = await prisma.predictionError.findMany({
      where: { seasonId: operationalSeason.id },
      select: { teamId: true, roundId: true },
      distinct: ['teamId', 'roundId'],
    })
    const scoredKeySet = new Set(scoredPairs.map((p) => `${p.teamId}-${p.roundId}`))
    const scoredSubmissionsCount = submissions.filter((s) => scoredKeySet.has(`${s.teamId}-${s.roundId}`)).length
    const uniqueTeamsCount = new Set(submissions.map((s) => s.teamId)).size

    const formattedSubmissions = submissions.flatMap((sub) => {
      const valuesByMarketWeek = new Map<string, { marketName: string; occupancy?: number; adr?: number; occAE?: number; adrAE?: number }>()
      for (const val of sub.values) {
        const key = `${val.marketId}-${val.weekOffset}`
        const existing = valuesByMarketWeek.get(key) || { marketName: val.market.name }
        const absError = errorMap.get(`${sub.teamId}-${sub.roundId}-${val.marketId}-${val.metric}-${val.weekOffset}`)
        if (val.metric === 'OCCUPANCY') { existing.occupancy = val.value; existing.occAE = absError }
        else { existing.adr = val.value; existing.adrAE = absError }
        valuesByMarketWeek.set(key, existing)
      }
      return Array.from(valuesByMarketWeek.entries()).map(([key, values]) => {
        const [, weekOffsetStr] = key.split('-')
        return {
          id: `${sub.id}-${key}`, teamName: sub.team.name, teamDisplayId: sub.team.displayId,
          roundNumber: sub.round.number, marketName: values.marketName, weekOffset: parseInt(weekOffsetStr),
          occupancy: values.occupancy ?? null, adr: values.adr ?? null,
          submittedAt: sub.submittedAt.toISOString(),
          submitterName: `${sub.submittedBy.firstName} ${sub.submittedBy.lastName}`, submitterEmail: sub.submittedBy.email,
          hasScore: values.occAE !== undefined || values.adrAE !== undefined, occupancyAE: values.occAE, adrAE: values.adrAE,
        }
      })
    })

    return jsonOk({ submissions: formattedSubmissions, totalSubmissions: submissions.length, scoredSubmissionsCount, uniqueTeamsCount })
  } catch (error) {
    return jsonError(error, 'Failed to fetch submissions')
  }
}
