import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse('submissions:read')
    if (response) return response

    const { searchParams } = new URL(request.url)
    const supervisorId = searchParams.get('supervisorId')
    const format = searchParams.get('format') || 'csv'

    const operationalSeason = await getCurrentOperationalSeason({
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: { where: { isActive: true }, include: { market: true } },
      },
    })

    if (!operationalSeason) {
      return jsonError('No operational season found')
    }

    const whereClause: any = {
      seasonId: operationalSeason.id,
      status: { in: ['ACTIVE', 'DISQUALIFIED'] },
    }
    if (supervisorId) {
      whereClause.supervisorId = supervisorId
    }

    const teams = await prisma.team.findMany({
      where: whereClause,
      include: {
        supervisor: { select: { firstName: true, lastName: true, email: true } },
        university: { select: { name: true } },
        submissions: {
          where: { round: { seasonId: operationalSeason.id } },
          include: { round: true },
        },
        warnings: {
          where: { round: { seasonId: operationalSeason.id } },
          include: { round: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const scoreAggregates = await prisma.scoreAggregate.findMany({
      where: { seasonId: operationalSeason.id, scopeType: 'SEASON' },
      orderBy: { mape: 'asc' },
    })

    const rankMap = new Map<string, number>()
    scoreAggregates.forEach((sa, i) => rankMap.set(sa.teamId, i + 1))

    const rounds = operationalSeason.rounds
    const headers = [
      'Team Name',
      'University',
      'Supervisor',
      'Supervisor Email',
      'Status',
      ...rounds.map(r => `R${r.number} Submitted`),
      ...rounds.map(r => `R${r.number} Warnings`),
      'Total Warnings',
      'Overall Rank',
    ]

    const rows = teams.map(team => {
      const supervisorName = team.supervisor
        ? `${team.supervisor.firstName} ${team.supervisor.lastName}`
        : 'None'
      const supervisorEmail = team.supervisor?.email || ''
      const totalWarnings = team.warnings.length

      const submissionByRound = new Map(
        team.submissions.map(s => [s.roundId, true])
      )
      const warningsByRound = new Map<string, number>()
      team.warnings.forEach(w => {
        warningsByRound.set(w.roundId, (warningsByRound.get(w.roundId) || 0) + 1)
      })

      return [
        team.name,
        team.university?.name || 'Unknown',
        supervisorName,
        supervisorEmail,
        team.status,
        ...rounds.map(r => submissionByRound.has(r.id) ? 'Yes' : 'No'),
        ...rounds.map(r => String(warningsByRound.get(r.id) || 0)),
        String(totalWarnings),
        String(rankMap.get(team.id) || 'Unranked'),
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const filename = supervisorId
      ? `instructor-report-${supervisorId}.csv`
      : `instructor-report-all-${new Date().toISOString().split('T')[0]}.csv`

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return jsonError(error, 'Failed to generate instructor report')
  }
}
