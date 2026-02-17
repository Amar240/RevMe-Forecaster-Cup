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
        { round: { number: 'desc' } },
        { submittedAt: 'desc' },
      ],
    })

    const errors = await prisma.predictionError.findMany()
    const errorMap = new Map<string, number>()
    for (const err of errors) {
      const key = `${err.teamId}-${err.roundId}-${err.marketId}-${err.metric}-${err.weekOffset}`
      errorMap.set(key, err.absError)
    }

    const formattedSubmissions = submissions.flatMap((sub) => {
      const valuesByMarketWeek = new Map<string, { marketName: string; occupancy?: number; adr?: number; occAE?: number; adrAE?: number }>()
      
      for (const val of sub.values) {
        const key = `${val.marketId}-${val.weekOffset}`
        const existing = valuesByMarketWeek.get(key) || { marketName: val.market.name }
        const errorKey = `${sub.teamId}-${sub.roundId}-${val.marketId}-${val.metric}-${val.weekOffset}`
        const absError = errorMap.get(errorKey)
        
        if (val.metric === 'OCCUPANCY') {
          existing.occupancy = val.value
          existing.occAE = absError
        } else {
          existing.adr = val.value
          existing.adrAE = absError
        }
        valuesByMarketWeek.set(key, existing)
      }

      const results: Array<{
        id: string
        teamName: string
        teamDisplayId: string
        roundNumber: number
        marketName: string
        weekOffset: number
        occupancy: number | null
        adr: number | null
        submittedAt: string
        submitterName: string
        submitterEmail: string
        hasScore: boolean
        occupancyAE: number | undefined
        adrAE: number | undefined
      }> = []

      for (const [key, values] of Array.from(valuesByMarketWeek.entries())) {
        const [, weekOffsetStr] = key.split('-')
        results.push({
          id: `${sub.id}-${key}`,
          teamName: sub.team.name,
          teamDisplayId: sub.team.displayId,
          roundNumber: sub.round.number,
          marketName: values.marketName,
          weekOffset: parseInt(weekOffsetStr),
          occupancy: values.occupancy ?? null,
          adr: values.adr ?? null,
          submittedAt: sub.submittedAt.toISOString(),
          submitterName: `${sub.submittedBy.firstName} ${sub.submittedBy.lastName}`,
          submitterEmail: sub.submittedBy.email,
          hasScore: values.occAE !== undefined || values.adrAE !== undefined,
          occupancyAE: values.occAE,
          adrAE: values.adrAE,
        })
      }

      return results
    })

    return NextResponse.json({ submissions: formattedSubmissions })
  } catch (error) {
    console.error('Submissions fetch error:', error)
    return NextResponse.json({ message: 'Failed to fetch submissions' }, { status: 500 })
  }
}
