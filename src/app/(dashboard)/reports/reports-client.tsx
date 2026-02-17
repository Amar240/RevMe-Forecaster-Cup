'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Download, ChevronDown, ChevronUp } from 'lucide-react'

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

export function SupervisorReportsClient({ teams }: Props) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => {
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
    const rows = team.predictions.map(p => [
      p.round,
      p.market,
      p.metric,
      `Week +${p.weekOffset}`,
      p.metric === 'OCCUPANCY' ? `${p.predicted.toFixed(1)}` : `$${p.predicted.toFixed(2)}`,
      p.metric === 'OCCUPANCY' ? `${p.actual.toFixed(1)}` : `$${p.actual.toFixed(2)}`,
      p.metric === 'OCCUPANCY' ? `${p.error.toFixed(2)}` : `$${p.error.toFixed(2)}`,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

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
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Team performance summaries</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Teams</h3>
            <p className="text-gray-500">No teams to report on.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600">Team performance summaries with detailed predictions</p>
      </div>

      <div className="space-y-6">
        {teams.map((team) => {
          const isExpanded = expandedTeams.has(team.id)

          return (
            <Card key={team.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{team.name}</CardTitle>
                    <CardDescription>
                      {team.universityName} | Status: {team.status}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {team.predictions.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadCSV(team)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-5 gap-4 mb-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Submissions</p>
                    <p className="text-xl font-bold">{team.submissionsCount}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">Scored Predictions</p>
                    <p className="text-xl font-bold">{team.scoredCount}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-sm text-amber-600">Final Score</p>
                    <p className="text-xl font-bold text-amber-700">
                      {(((team.occMAPE + team.adrMAPE) / 2) * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600">Occupancy MAPE</p>
                    <p className="text-xl font-bold text-blue-700">
                      {(team.occMAPE * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg">
                    <p className="text-sm text-emerald-600">ADR MAPE</p>
                    <p className="text-xl font-bold text-emerald-700">
                      {(team.adrMAPE * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                {team.warnings.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg mb-4">
                    <p className="text-sm text-amber-700 font-medium">
                      Warnings: {team.warnings.length}
                    </p>
                    <ul className="text-sm text-amber-600 mt-1">
                      {team.warnings.map((w) => (
                        <li key={w.id}>Round {w.roundNumber}: {w.message}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {team.predictions.length > 0 && (
                  <div className="border rounded-lg">
                    <button
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
                      onClick={() => toggleTeam(team.id)}
                    >
                      <span className="font-medium text-gray-700">
                        View Detailed Predictions ({team.predictions.length})
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr className="text-left">
                              <th className="px-3 py-2 font-medium text-gray-600">Round</th>
                              <th className="px-3 py-2 font-medium text-gray-600">Market</th>
                              <th className="px-3 py-2 font-medium text-gray-600">Metric</th>
                              <th className="px-3 py-2 font-medium text-gray-600">Week</th>
                              <th className="px-3 py-2 font-medium text-gray-600 text-right">Predicted</th>
                              <th className="px-3 py-2 font-medium text-gray-600 text-right">Actual</th>
                              <th className="px-3 py-2 font-medium text-gray-600 text-right">Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {team.predictions.map((pred, idx) => (
                              <tr key={idx} className="border-t hover:bg-gray-50">
                                <td className="px-3 py-2">Round {pred.round}</td>
                                <td className="px-3 py-2">{pred.market}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 text-xs rounded ${
                                    pred.metric === 'OCCUPANCY'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}>
                                    {pred.metric}
                                  </span>
                                </td>
                                <td className="px-3 py-2">Week +{pred.weekOffset}</td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {formatValue(pred.predicted, pred.metric)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {formatValue(pred.actual, pred.metric)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <span className={`px-2 py-0.5 text-xs rounded font-semibold ${
                                    pred.error < (pred.metric === 'OCCUPANCY' ? 5 : 10)
                                      ? 'bg-green-100 text-green-700'
                                      : pred.error < (pred.metric === 'OCCUPANCY' ? 10 : 20)
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {formatValue(pred.error, pred.metric)}
                                  </span>
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
