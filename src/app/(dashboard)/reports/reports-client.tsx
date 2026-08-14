'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Download, FileText } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Prediction {
  round: number
  market: string
  metric: string
  weekOffset: number
  predicted: number
  actual: number
  error: number
}

interface Warning {
  id: string
  roundNumber: number
  message: string | null
}

interface TeamData {
  id: string
  name: string
  universityName: string
  status: string
  submissionsCount: number
  scoredCount: number
  occMAPE: number
  adrMAPE: number
  warnings: Warning[]
  predictions: Prediction[]
}

interface Props {
  teams: TeamData[]
}

function getErrorVariant(metric: string, error: number) {
  const lowerBand = metric === 'OCCUPANCY' ? 5 : 10
  const middleBand = metric === 'OCCUPANCY' ? 10 : 20

  if (error < lowerBand) return 'success'
  if (error < middleBand) return 'warning'
  return 'error'
}

export function SupervisorReportsClient({ teams }: Props) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())

  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) {
        next.delete(teamId)
      } else {
        next.add(teamId)
      }
      return next
    })
  }

  const downloadCSV = (team: TeamData) => {
    const headers = ['Round', 'Market', 'Metric', 'Week Offset', 'Predicted', 'Actual', 'Error']
    const rows = team.predictions.map((prediction) => [
      prediction.round,
      prediction.market,
      prediction.metric,
      `Week +${prediction.weekOffset}`,
      prediction.metric === 'OCCUPANCY' ? `${prediction.predicted.toFixed(1)}` : `$${prediction.predicted.toFixed(2)}`,
      prediction.metric === 'OCCUPANCY' ? `${prediction.actual.toFixed(1)}` : `$${prediction.actual.toFixed(2)}`,
      prediction.metric === 'OCCUPANCY' ? `${prediction.error.toFixed(2)}` : `$${prediction.error.toFixed(2)}`,
    ])

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${team.name.replace(/\s+/g, '_')}_predictions.csv`
    link.click()
  }

  const formatValue = (value: number, metric: string) => {
    if (metric === 'OCCUPANCY') {
      return `${value.toFixed(1)}`
    }
    return `$${value.toFixed(2)}`
  }

  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reports</h1>
          <p className="text-text-secondary">Team performance summaries</p>
        </div>
        <Card>
          <CardContent className="p-0">
            <EmptyState icon={<FileText className="h-7 w-7" />} title="No Teams" description="No teams to report on." />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reports</h1>
        <p className="text-text-secondary">Team performance summaries with detailed predictions</p>
      </div>

      <div className="space-y-6">
        {teams.map((team) => {
          const isExpanded = expandedTeams.has(team.id)

          return (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>{team.name}</CardTitle>
                    <CardDescription>
                      {team.universityName} | Status: {team.status}
                    </CardDescription>
                  </div>
                  {team.predictions.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => downloadCSV(team)}>
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-4 md:grid-cols-5">
                  <div className="rounded-lg border border-border bg-surface-secondary p-4">
                    <p className="text-sm text-muted-foreground">Submissions</p>
                    <p className="text-2xl font-semibold text-foreground">{team.submissionsCount}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-surface-secondary p-4">
                    <p className="text-sm text-muted-foreground">Scored Predictions</p>
                    <p className="text-2xl font-semibold text-foreground">{team.scoredCount}</p>
                  </div>
                  <div className="rounded-lg border border-accent/20 bg-accent-soft p-4">
                    <p className="text-sm text-accent">Cumulative Score</p>
                    <p className="text-2xl font-semibold text-accent">
                      {(((team.occMAPE + team.adrMAPE) / 2) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary-soft p-4">
                    <p className="text-sm text-primary">Occupancy MAPE</p>
                    <p className="text-2xl font-semibold text-primary">{(team.occMAPE * 100).toFixed(2)}%</p>
                  </div>
                  <div className="rounded-lg border border-success/20 bg-success-background p-4">
                    <p className="text-sm text-success">ADR MAPE</p>
                    <p className="text-2xl font-semibold text-success">{(team.adrMAPE * 100).toFixed(2)}%</p>
                  </div>
                </div>

                {team.warnings.length > 0 && (
                  <div className="mb-4 rounded-lg border border-warning/20 bg-warning-background p-4">
                    <p className="font-medium text-foreground">Warnings: {team.warnings.length}</p>
                    <ul className="mt-2 space-y-1 text-sm text-text-secondary">
                      {team.warnings.map((warning) => (
                        <li key={warning.id}>
                          Round {warning.roundNumber}: {warning.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {team.predictions.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <button
                      className="flex w-full items-center justify-between bg-surface-secondary px-4 py-3 text-left transition-colors hover:bg-muted"
                      onClick={() => toggleTeam(team.id)}
                    >
                      <span className="font-medium text-foreground">View Detailed Predictions ({team.predictions.length})</span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-text-muted" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-text-muted" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="overflow-x-auto border-t border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted">
                            <tr className="text-left">
                              <th className="px-4 py-3 font-medium text-muted-foreground">Round</th>
                              <th className="px-4 py-3 font-medium text-muted-foreground">Market</th>
                              <th className="px-4 py-3 font-medium text-muted-foreground">Metric</th>
                              <th className="px-4 py-3 font-medium text-muted-foreground">Week</th>
                              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Predicted</th>
                              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actual</th>
                              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Error</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-card">
                            {team.predictions.map((prediction, idx) => (
                              <tr key={idx} className="hover:bg-surface-secondary">
                                <td className="px-4 py-3 text-foreground">Round {prediction.round}</td>
                                <td className="px-4 py-3 text-text-secondary">{prediction.market}</td>
                                <td className="px-4 py-3">
                                  <Badge variant={prediction.metric === 'OCCUPANCY' ? 'info' : 'success'}>
                                    {prediction.metric}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-text-secondary">Week +{prediction.weekOffset}</td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">
                                  {formatValue(prediction.predicted, prediction.metric)}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-foreground">
                                  {formatValue(prediction.actual, prediction.metric)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Badge variant={getErrorVariant(prediction.metric, prediction.error) as 'success' | 'warning' | 'error'}>
                                    {formatValue(prediction.error, prediction.metric)}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
