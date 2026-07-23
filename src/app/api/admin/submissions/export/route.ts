import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason()
    if (!operationalSeason) {
      return new NextResponse('', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="all-submissions.csv"',
        },
      })
    }

    const submissions = await prisma.submission.findMany({
      where: { round: { seasonId: operationalSeason.id } },
      include: { team: true, round: true, submittedBy: true, values: { include: { market: true } } },
      orderBy: [{ round: { number: 'asc' } }, { team: { displayId: 'asc' } }],
    })

    const errors = await prisma.predictionError.findMany({
      where: { seasonId: operationalSeason.id },
    })
    const errorMap = new Map<string, number>()
    for (const err of errors) {
      errorMap.set(`${err.teamId}-${err.roundId}-${err.marketId}-${err.metric}-${err.weekOffset}`, err.absError)
    }

    const headers = ['Team ID', 'Team Name', 'Round', 'Market', 'Week Offset', 'Metric', 'Predicted Value', 'Submitted At', 'Submitter Name', 'Submitter Email', 'Absolute Error']
    const rows: string[][] = []
    for (const sub of submissions) {
      for (const val of sub.values) {
        const absError = errorMap.get(`${sub.teamId}-${sub.roundId}-${val.marketId}-${val.metric}-${val.weekOffset}`)
        rows.push([
          sub.team.displayId, sub.team.name, String(sub.round.number), val.market.name,
          String(val.weekOffset), val.metric, String(val.value), sub.submittedAt.toISOString(),
          `${sub.submittedBy.firstName} ${sub.submittedBy.lastName}`, sub.submittedBy.email, absError?.toFixed(4) || '',
        ])
      }
    }

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="all-submissions.csv"' } })
  } catch (error) {
    return jsonError(error, 'Failed to export')
  }
}
