import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { resolveScoreTeam } from '@/server/scoped-score-team'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason()
    if (!operationalSeason) {
      return new NextResponse('No current season found', { status: 404 })
    }

    const team = await resolveScoreTeam({ userId: user!.id, role: user!.role, seasonId: operationalSeason.id, requestedTeamId: new URL(request.url).searchParams.get('teamId') })
    if (!team) {
      return new NextResponse('No team found', { status: 404 })
    }

    const submissions = await prisma.submission.findMany({
      where: {
        teamId: team.id,
        round: { seasonId: operationalSeason.id },
      },
      include: { round: true, values: { include: { market: true } } },
      orderBy: [{ round: { number: 'asc' } }],
    })

    const errors = await prisma.predictionError.findMany({
      where: { teamId: team.id, seasonId: operationalSeason.id },
    })
    const errorMap = new Map<string, number>()
    for (const err of errors) {
      errorMap.set(`${err.roundId}-${err.marketId}-${err.metric}-${err.weekOffset}`, err.absError)
    }

    const csvRows = [
      ['Round', 'Market', 'Week Offset', 'Metric', 'Predicted Value', 'Submitted At', 'Absolute Error'],
    ]

    for (const sub of submissions) {
      for (const val of sub.values) {
        const absError = errorMap.get(`${sub.roundId}-${val.marketId}-${val.metric}-${val.weekOffset}`)
        csvRows.push([
          `Round ${sub.round.number}`, val.market.name, `Week+${val.weekOffset}`,
          val.metric, val.value.toFixed(2), new Date(sub.submittedAt).toISOString(), absError?.toFixed(4) || '',
        ])
      }
    }

    const csvContent = csvRows.map((row) => row.join(',')).join('\n')
    return new NextResponse(csvContent, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="submissions-${team.displayId}.csv"` },
    })
  } catch (error) {
    return jsonError(error, 'Failed to export')
  }
}
