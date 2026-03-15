'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import type { AdminScoringScope } from '@/lib/scoring-admin'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AccessDenied } from '@/components/ui/access-denied'
import { PreflightCheck } from '@/components/admin/scoring/PreflightCheck'
import { AnomalyAlerts } from '@/components/admin/scoring/AnomalyAlerts'
import {
  AlertCircle,
  AlertTriangle,
  Calculator,
  Check,
  CheckCircle,
  Clock,
  Database,
  FileSpreadsheet,
  Loader2,
  Lock,
  PlayCircle,
  RefreshCw,
  XCircle,
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

function getCoverageVariant(complete: number, expected: number) {
  const pct = expected > 0 ? (complete / expected) * 100 : 0
  if (pct === 100) return 'success'
  if (pct >= 50) return 'warning'
  return 'error'
}

function getRunVariant(status: string) {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'error'
  return 'warning'
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded bg-surface-secondary" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
        <div className="h-10 w-24 rounded bg-surface-secondary" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-surface-secondary" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="h-5 w-40 rounded bg-surface-secondary" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="h-5 w-28 rounded bg-surface-secondary" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-10 w-32 rounded bg-surface-secondary" />
      </div>
    </div>
  )
}

export default function ScoringControlCenterPage() {
  const { loading: permLoading, canPerform } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; count?: number } | null>(null)
  const [roundStatuses, setRoundStatuses] = useState<RoundStatus[]>([])
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([])
  const [selectedRound, setSelectedRound] = useState<string | null>(null)
  const [scopeMode, setScopeMode] = useState<AdminScoringScope>('SEASON')
  const [seasonName, setSeasonName] = useState('')
  const [hasStaleScores, setHasStaleScores] = useState(false)
  const [preflightOpen, setPreflightOpen] = useState(false)

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
      toast.error('Failed to load scoring data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && canPerform('scoring:run')) {
      void fetchData()
    }
  }, [permLoading, canPerform, fetchData])

  const runScoring = async () => {
    setRunning(true)
    setResult(null)

    try {
      const body: { scope: AdminScoringScope; roundId?: string } = { scope: scopeMode }
      if (scopeMode === 'ROUND' && selectedRound) {
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
        count: data.errorsUpserted ?? data.aggregatesUpserted,
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

  if (permLoading || loading) {
    return <LoadingSkeleton />
  }

  if (!canPerform('scoring:run')) {
    return (
      <AccessDenied
        title="Access Denied"
        message="You do not have permission to access the Scoring Control Center. Please contact an administrator for access."
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Scoring Control Center</h1>
          <p className="text-text-secondary">{seasonName || 'Manage scoring and calculations'}</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {hasStaleScores && (
        <Card className="border-warning/20 bg-warning-background">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium text-foreground">Scores are stale</p>
                <p className="text-sm text-text-secondary">
                  Actuals have been modified after scoring. Re-run scoring to update leaderboards.
                </p>
              </div>
            </div>
            <Button onClick={() => setPreflightOpen(true)} disabled={running}>
              {running ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              Re-run Scoring
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={result.success ? 'border-success/20 bg-success-background' : 'border-error/20 bg-error-background'}>
          <CardContent className="flex items-center space-x-3 py-4">
            {result.success ? <Check className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-error" />}
            <div>
              <p className={result.success ? 'text-success' : 'text-error'}>{result.message}</p>
              {result.count !== undefined && <p className="text-sm text-text-secondary">{result.count} records processed</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card variant="metric">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-primary" />
              <span>Actuals Status</span>
            </CardTitle>
            <CardDescription>Upload status for actual occupancy and ADR values per round</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roundStatuses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rounds configured</p>
              ) : (
                roundStatuses.map((round) => {
                  const coverageVariant = getCoverageVariant(round.actualsCount, round.expectedActuals) as
                    | 'success'
                    | 'warning'
                    | 'error'
                  return (
                    <div key={round.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-foreground">
                          Round {round.number} {round.isFinal && '(Final)'}
                        </span>
                        {round.isLockedActuals && (
                          <Badge variant="neutral" className="gap-1 px-1.5 py-0.5">
                            <Lock className="h-3 w-3" />
                          </Badge>
                        )}
                        {round.scoresStale && (
                          <Badge variant="warning" className="gap-1 px-1.5 py-0.5">
                            <AlertTriangle className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={coverageVariant}>{round.actualsCount}/{round.expectedActuals}</Badge>
                        {round.actualsCount === round.expectedActuals ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-text-muted" />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card variant="metric">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="h-5 w-5 text-info" />
              <span>Submission Status</span>
            </CardTitle>
            <CardDescription>Team submission coverage per round</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roundStatuses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rounds configured</p>
              ) : (
                roundStatuses.map((round) => {
                  const coverageVariant = getCoverageVariant(round.teamsWithSubmissions, round.totalActiveTeams) as
                    | 'success'
                    | 'warning'
                    | 'error'
                  return (
                    <div key={round.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                      <span className="font-medium text-foreground">Round {round.number}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={coverageVariant}>
                          {round.teamsWithSubmissions}/{round.totalActiveTeams} teams
                        </Badge>
                        {round.teamsWithSubmissions === round.totalActiveTeams ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-text-muted" />
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-success" />
            <span>Run Scoring</span>
          </CardTitle>
          <CardDescription>
            Calculate Mean Absolute Percentage Error (MAPE) for submissions with matching actuals. Scoring is idempotent,
            so running it more than once is safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="radio"
                id="scope-all"
                name="scope"
                value="all"
                checked={scopeMode === 'SEASON'}
                onChange={() => setScopeMode('SEASON')}
                className="h-4 w-4 border-border text-primary focus:ring-primary"
              />
              Score all rounds
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="radio"
                id="scope-round"
                name="scope"
                value="round"
                checked={scopeMode === 'ROUND'}
                onChange={() => setScopeMode('ROUND')}
                className="h-4 w-4 border-border text-primary focus:ring-primary"
              />
              Specific round
            </label>
          </div>

          {scopeMode === 'ROUND' && (
            <Select value={selectedRound || ''} onValueChange={setSelectedRound}>
              <SelectTrigger>
                <SelectValue placeholder="Select a round..." />
              </SelectTrigger>
              <SelectContent>
                {roundStatuses.map((round) => (
                  <SelectItem key={round.id} value={round.id}>
                    Round {round.number} {round.isFinal ? '(Final)' : ''} - {round.actualsCount}/{round.expectedActuals} actuals
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setPreflightOpen(true)} disabled={running || (scopeMode === 'ROUND' && !selectedRound)}>
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Run Scoring
                </>
              )}
            </Button>

            <Button onClick={runWarnings} variant="outline" disabled={running}>
              <AlertCircle className="mr-2 h-4 w-4" />
              Check Warnings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-text-secondary" />
            <span>Recent Scoring Runs</span>
          </CardTitle>
          <CardDescription>Audit trail of scoring operations</CardDescription>
        </CardHeader>
        <CardContent>
          {scoringRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scoring runs yet</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Admin</th>
                    <th className="px-4 py-3 font-medium">Scope</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Errors</th>
                    <th className="px-4 py-3 text-right font-medium">Aggregates</th>
                    <th className="px-4 py-3 text-right font-medium">Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {scoringRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="px-4 py-3 text-foreground">{formatDate(run.startedAt)}</td>
                      <td className="max-w-[120px] truncate px-4 py-3 text-text-secondary">{run.adminEmail}</td>
                      <td className="px-4 py-3">
                        <Badge variant="info">{run.scope}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getRunVariant(run.status) as 'success' | 'warning' | 'error'}>{run.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{run.errorsProcessed}</td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">{run.aggregatesProcessed}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">
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

      <AnomalyAlerts />

      <PreflightCheck
        open={preflightOpen}
        onOpenChange={setPreflightOpen}
        onConfirmScore={() => {
          setPreflightOpen(false)
          void runScoring()
        }}
        scoring={running}
      />
    </div>
  )
}
