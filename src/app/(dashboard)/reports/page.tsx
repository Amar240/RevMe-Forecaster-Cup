import { redirect } from 'next/navigation'
import { getSession } from '@/server/auth'
import { prisma } from '@/server/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Download, ChevronDown, ChevronUp } from 'lucide-react'
import { SupervisorReportsClient } from './reports-client'

export default async function ReportsPage() {
  const user = await getSession()
  if (!user) redirect('/login')
  if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN') {
    redirect('/dashboard')
  }

  const teams = await prisma.team.findMany({
    where: user.role === 'ADMIN' || user.role === 'SUB_ADMIN' ? {} : { supervisorId: user.id },
    include: {
      university: true,
      submissions: {
        include: {
          round: true,
          values: {
            include: { market: true },
          },
        },
        orderBy: [{ round: { number: 'asc' } }],
      },
      warnings: { include: { round: true } },
    },
  })

  const teamAggregates = await Promise.all(
    teams.map(async (team) => {
      const aggregates = await prisma.scoreAggregate.findMany({
        where: { teamId: team.id, scopeType: 'SEASON' },
      })
      const occAggregate = aggregates.find((a) => a.metric === 'OCCUPANCY')
      const adrAggregate = aggregates.find((a) => a.metric === 'ADR')
      
      const predictionErrors = await prisma.predictionError.findMany({
        where: { teamId: team.id },
        include: {
          round: { select: { number: true } },
          market: { select: { name: true } },
        },
        orderBy: [{ round: { number: 'asc' } }, { market: { name: 'asc' } }],
      })
      
      return {
        teamId: team.id,
        occMAPE: occAggregate?.mape || 0,
        adrMAPE: adrAggregate?.mape || 0,
        occCount: occAggregate?.nErrors || 0,
        adrCount: adrAggregate?.nErrors || 0,
        predictions: predictionErrors.map(pe => ({
          round: pe.round.number,
          market: pe.market.name,
          metric: pe.metric,
          weekOffset: pe.weekOffset,
          predicted: pe.predictedValue,
          actual: pe.actualValue,
          error: pe.absError,
        })),
      }
    })
  )

  const teamsData = teams.map((team) => {
    const agg = teamAggregates.find((a) => a.teamId === team.id)
    return {
      id: team.id,
      name: team.name,
      universityName: team.university.name,
      status: team.status,
      submissionsCount: team.submissions.length,
      scoredCount: Math.max(agg?.occCount || 0, agg?.adrCount || 0),
      occMAPE: agg?.occMAPE || 0,
      adrMAPE: agg?.adrMAPE || 0,
      warnings: team.warnings.map(w => ({
        id: w.id,
        roundNumber: w.round.number,
        message: w.message,
      })),
      predictions: agg?.predictions || [],
    }
  })

  return <SupervisorReportsClient teams={teamsData} />
}
