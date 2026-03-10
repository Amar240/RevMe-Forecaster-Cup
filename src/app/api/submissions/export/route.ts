import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: user!.id },
      include: { team: true },
    })

    if (!teamMember) {
      return new NextResponse('No team found', { status: 404 })
    }

    const submissions = await prisma.submission.findMany({
      where: { teamId: teamMember.teamId },
      include: { round: true, values: { include: { market: true } } },
      orderBy: [{ round: { number: 'asc' } }],
    })

    const errors = await prisma.predictionError.findMany({ where: { teamId: teamMember.teamId } })
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
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="submissions-${teamMember.team.displayId}.csv"` },
    })
  } catch (error) {
    return jsonError(error, 'Failed to export')
  }
}
