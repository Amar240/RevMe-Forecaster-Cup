import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const submissions = await prisma.submission.findMany({
      include: {
        team: true,
        round: true,
        submittedBy: true,
        values: {
          include: {
            market: true,
          },
        },
      },
      orderBy: [
        { round: { number: 'asc' } },
        { team: { displayId: 'asc' } },
      ],
    })

    const errors = await prisma.predictionError.findMany()
    const errorMap = new Map<string, number>()
    for (const err of errors) {
      const key = `${err.teamId}-${err.roundId}-${err.marketId}-${err.metric}-${err.weekOffset}`
      errorMap.set(key, err.absError)
    }

    const headers = [
      'Team ID',
      'Team Name',
      'Round',
      'Market',
      'Week Offset',
      'Metric',
      'Predicted Value',
      'Submitted At',
      'Submitter Name',
      'Submitter Email',
      'Absolute Error',
    ]

    const rows: string[][] = []
    for (const sub of submissions) {
      for (const val of sub.values) {
        const errorKey = `${sub.teamId}-${sub.roundId}-${val.marketId}-${val.metric}-${val.weekOffset}`
        const absError = errorMap.get(errorKey)
        rows.push([
          sub.team.displayId,
          sub.team.name,
          String(sub.round.number),
          val.market.name,
          String(val.weekOffset),
          val.metric,
          String(val.value),
          sub.submittedAt.toISOString(),
          `${sub.submittedBy.firstName} ${sub.submittedBy.lastName}`,
          sub.submittedBy.email,
          absError?.toFixed(4) || '',
        ])
      }
    }

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="all-submissions.csv"',
      },
    })
  } catch (error) {
    console.error('Admin export error:', error)
    return NextResponse.json({ message: 'Failed to export' }, { status: 500 })
  }
}
