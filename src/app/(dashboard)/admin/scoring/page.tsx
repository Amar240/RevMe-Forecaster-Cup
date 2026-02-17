'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AccessDenied } from '@/components/ui/access-denied'
import { usePermissions } from '@/hooks/usePermissions'
import { 
  Calculator, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  PlayCircle, 
  Database,
  FileSpreadsheet,
  Clock,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  Loader2
} from 'lucide-react'

interface RoundStatus {
  id: string
  number: number
  isFinal: boolean
  opensAt: string
  closesAt: string
  actualsCount: number
  expectedActuals: number
  submissionCount: number
  teamsWithSubmissions: number
  totalActiveTeams: number
  scoringComplete: boolean
  isLockedActuals: boolean
  scoresStale: boolean
  lastScoredAt: string | null
  actualsVersion: number
}

interface ScoringRun {
  id: string
  startedAt: string
  completedAt: string | null
  status: string
  scope: string
  roundId: string | null
  adminEmail: string
  errorsProcessed: number
  aggregatesProcessed: number
  actualsVersionAtRun: number | null
  summaryJson: unknown
}

export default function ScoringControlCenterPage() {
  const { loading: permLoading, canPerform } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)
  const [roundStatuses, setRoundStatuses] = useState<RoundStatus[]>([])
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([])
  const [selectedRound, setSelectedRound] = useState<string | null>(null)
  const [scopeMode, setScopeMode] = useState<'all' | 'round'>('all')
  const [seasonName, setSeasonName] = useState('')
  const [hasStaleScores, setHasStaleScores] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await csrfFetch('/api/admin/scoring/status')
      if (res.ok) {
        const data = await res.json()
        setRoundStatuses(data.rounds || [])
        setScoringRuns(data.recentRuns || [])
        setSeasonName(data.seasonName || '')
        setHasStaleScores(data.hasStaleScores || false)
      }
    } catch (err) {
      clientLogger.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && canPerform('scoring:run')) {
      fetchData()
    }
  }, [permLoading, canPerform, fetchData])

  if (permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!canPerform('scoring:run')) {
    return <AccessDenied title="Access Denied" message="You do not have permission to access the Scoring Control Center. Please contact an administrator for access." />
  }


  const runScoring = async () => {
    setRunning(true)
    setResult(null)

    try {
      const body: { scope: string; roundId?: string } = { scope: scopeMode }
      if (scopeMode === 'round' && selectedRound) {
        body.roundId = selectedRound
      }

      const res = await csrfFetch('/api/admin/scoring/run', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      setResult({
        success: res.ok,
        message: data.message,
        count: data.errorsCreated || data.aggregatesCreated,
      })
      await fetchData()
    } catch {
      setResult({ success: false, message: 'An error occurred' })
    } finally {
      setRunning(false)
    }
  }

  const runWarnings = async () => {
    setRunning(true)
    setResult(null)

    try {
      const res = await csrfFetch('/api/admin/warnings/run', { method: 'POST' })
      const data = await res.json()

      setResult({
        success: res.ok,
        message: data.message,
        count: data.warningsCreated,
      })
    } catch {
      setResult({ success: false, message: 'An error occurred' })
    } finally {
      setRunning(false)
    }
  }

  const getStatusColor = (complete: number, expected: number) => {
    const pct = expected > 0 ? (complete / expected) * 100 : 0
    if (pct === 100) return 'text-green-600'
    if (pct >= 50) return 'text-amber-600'
    return 'text-red-600'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scoring Control Center</h1>
          <p className="text-gray-600">{seasonName || 'Manage scoring and calculations'}</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {hasStaleScores && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Scores are stale</p>
                <p className="text-sm text-amber-700">
                  Actuals have been modified after scoring. Re-run scoring to update leaderboards.
                </p>
              </div>
            </div>
            <Button 
              onClick={runScoring}
              disabled={running}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {running ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Re-run Scoring
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          <CardContent className="py-4 flex items-center space-x-3">
            {result.success ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <div>
              <p className={result.success ? 'text-green-700' : 'text-red-700'}>
                {result.message}
              </p>
              {result.count !== undefined && (
                <p className="text-sm text-gray-600">
                  {result.count} records processed
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-600" />
              <span>Actuals Status</span>
            </CardTitle>
            <CardDescription>
              Upload status for actual occupancy and ADR values per round
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roundStatuses.length === 0 ? (
                <p className="text-gray-500 text-sm">No rounds configured</p>
              ) : (
                roundStatuses.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        Round {r.number} {r.isFinal && '(Final)'}
                      </span>
                      {r.isLockedActuals && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                      {r.scoresStale && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-semibold ${getStatusColor(r.actualsCount, r.expectedActuals)}`}>
                        {r.actualsCount}/{r.expectedActuals}
                      </span>
                      {r.actualsCount === r.expectedActuals ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              <span>Submission Status</span>
            </CardTitle>
            <CardDescription>
              Team submission coverage per round
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roundStatuses.length === 0 ? (
                <p className="text-gray-500 text-sm">No rounds configured</p>
              ) : (
                roundStatuses.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">
                        Round {r.number}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-semibold ${getStatusColor(r.teamsWithSubmissions, r.totalActiveTeams)}`}>
                        {r.teamsWithSubmissions}/{r.totalActiveTeams} teams
                      </span>
                      {r.teamsWithSubmissions === r.totalActiveTeams ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-emerald-600" />
            <span>Run Scoring</span>
          </CardTitle>
          <CardDescription>
            Calculate Mean Absolute Percentage Error (MAPE) for submissions with matching actuals.
            Scoring is idempotent - running multiple times is safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="scope-all"
                name="scope"
                value="all"
                checked={scopeMode === 'all'}
                onChange={() => setScopeMode('all')}
                className="text-blue-600"
              />
              <label htmlFor="scope-all" className="text-sm font-medium text-gray-700">
                Score All Rounds
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="scope-round"
                name="scope"
                value="round"
                checked={scopeMode === 'round'}
                onChange={() => setScopeMode('round')}
                className="text-blue-600"
              />
              <label htmlFor="scope-round" className="text-sm font-medium text-gray-700">
                Specific Round
              </label>
            </div>
          </div>

          {scopeMode === 'round' && (
            <select
              value={selectedRound || ''}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="">Select a round...</option>
              {roundStatuses.map((r) => (
                <option key={r.id} value={r.id}>
                  Round {r.number} {r.isFinal ? '(Final)' : ''} - {r.actualsCount}/{r.expectedActuals} actuals
                </option>
              ))}
            </select>
          )}

          <div className="flex space-x-3">
            <Button 
              onClick={runScoring} 
              disabled={running || (scopeMode === 'round' && !selectedRound)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {running ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Run Scoring
                </>
              )}
            </Button>

            <Button onClick={runWarnings} variant="outline" disabled={running}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Check Warnings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-gray-600" />
            <span>Recent Scoring Runs</span>
          </CardTitle>
          <CardDescription>
            Audit trail of scoring operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scoringRuns.length === 0 ? (
            <p className="text-gray-500 text-sm">No scoring runs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">Admin</th>
                    <th className="pb-2 font-medium">Scope</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Errors</th>
                    <th className="pb-2 font-medium text-right">Aggregates</th>
                    <th className="pb-2 font-medium text-right">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {scoringRuns.map((run) => (
                    <tr key={run.id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-900">{formatDate(run.startedAt)}</td>
                      <td className="py-2 text-gray-600 max-w-[120px] truncate">{run.adminEmail}</td>
                      <td className="py-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {run.scope}
                        </span>
                      </td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          run.status === 'SUCCESS' 
                            ? 'bg-green-100 text-green-700'
                            : run.status === 'FAILED'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium">{run.errorsProcessed}</td>
                      <td className="py-2 text-right font-medium">{run.aggregatesProcessed}</td>
                      <td className="py-2 text-right text-gray-500">
                        {run.actualsVersionAtRun !== null ? `v${run.actualsVersionAtRun}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}




