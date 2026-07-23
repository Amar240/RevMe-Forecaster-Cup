'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { normalizePreflightDialogData, type PreflightDialogData } from '@/lib/scoring-admin'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface PreflightCheckProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmScore: () => void
  scoring: boolean
}

type CheckStatus = 'pass' | 'fail' | 'warn'

function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
    case 'fail':
      return <XCircle className="h-5 w-5 shrink-0 text-error" />
    case 'warn':
      return <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

function getSubmissionStatus(data: PreflightDialogData): CheckStatus {
  if (data.totalActiveTeams <= 0) return 'warn'
  if (data.teamsSubmitted === data.totalActiveTeams) return 'pass'
  if (data.teamsSubmitted / data.totalActiveTeams >= 0.8) return 'warn'
  return 'fail'
}

export function PreflightCheck({ open, onOpenChange, onConfirmScore, scoring }: PreflightCheckProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PreflightDialogData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setData(null)
      setError(null)
      return
    }

    let cancelled = false

    async function fetchPreflight() {
      setLoading(true)
      setError(null)

      try {
        const res = await csrfFetch('/api/admin/scoring/preflight')
        if (!res.ok) {
          throw new Error(`Preflight check failed (${res.status})`)
        }

        const json = await res.json()
        const normalized = normalizePreflightDialogData(json)
        if (!normalized) {
          throw new Error('Preflight payload is invalid')
        }

        if (!cancelled) {
          setData(normalized)
        }
      } catch (err) {
        clientLogger.error('Preflight fetch failed:', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preflight data')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchPreflight()

    return () => {
      cancelled = true
    }
  }, [open])

  const allChecksPassed =
    data !== null && !data.hasCriticalIssues && data.teamsAtRiskOfDQ === 0 && data.missedSubmissionWarnings === 0

  const hasWarnings =
    data !== null && !data.hasCriticalIssues && (data.teamsAtRiskOfDQ > 0 || data.missedSubmissionWarnings > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scoring Preflight Check</DialogTitle>
          <DialogDescription>Review data readiness before running scoring.</DialogDescription>
        </DialogHeader>

        {loading && <LoadingSkeleton />}

        {error && (
          <div className="flex items-center gap-3 rounded-md border border-error/20 bg-error-background p-4">
            <XCircle className="h-5 w-5 shrink-0 text-error" />
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {allChecksPassed && (
              <div className="flex items-center gap-3 rounded-md border border-success/20 bg-success-background p-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
                <p className="text-sm font-medium text-success">All checks passed</p>
              </div>
            )}

            {hasWarnings && (
              <div className="flex items-center gap-3 rounded-md border border-warning/20 bg-warning-background p-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                <p className="text-sm font-medium text-warning">Review issues before scoring</p>
              </div>
            )}

            {data.hasCriticalIssues && (
              <div className="flex items-center gap-3 rounded-md border border-error/20 bg-error-background p-3">
                <ShieldAlert className="h-5 w-5 shrink-0 text-error" />
                <p className="text-sm font-medium text-error">Critical issues must be resolved before scoring</p>
              </div>
            )}

            {data.teamsAtRiskOfDQ > 0 && (
              <div className="flex items-center gap-3 rounded-md border border-warning/20 bg-warning-background p-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">
                    {data.teamsAtRiskOfDQ} team{data.teamsAtRiskOfDQ === 1 ? '' : 's'}
                  </span>{' '}
                  at risk of disqualification
                </p>
              </div>
            )}

            <div className="space-y-3">
              {data.rounds.map((round) => {
                const status: CheckStatus = round.complete ? 'pass' : 'fail'

                return (
                  <div key={round.roundNumber} className="flex items-center gap-3">
                    <StatusIcon status={status} />
                    <span className="text-sm text-foreground">
                      Round {round.roundNumber}: {round.uploaded}/{round.expected} actuals uploaded
                      {!round.complete && <span className="ml-1.5 font-semibold text-error">- INCOMPLETE</span>}
                    </span>
                  </div>
                )
              })}

              <div className="flex items-center gap-3">
                <StatusIcon status={getSubmissionStatus(data)} />
                <span className="text-sm text-foreground">
                  {data.teamsSubmitted}/{data.totalActiveTeams} active teams submitted
                </span>
              </div>

              <div className="flex items-center gap-3">
                <StatusIcon status={data.missedSubmissionWarnings === 0 ? 'pass' : 'warn'} />
                <span className="text-sm text-foreground">
                  {data.missedSubmissionWarnings} team{data.missedSubmissionWarnings === 1 ? '' : 's'} will receive missed-submission warnings
                </span>
              </div>

              <div className="flex items-center gap-3">
                <StatusIcon status={data.teamsAtRiskOfDQ === 0 ? 'pass' : 'warn'} />
                <span className="text-sm text-foreground">
                  {data.teamsAtRiskOfDQ} team{data.teamsAtRiskOfDQ === 1 ? '' : 's'} at risk of disqualification
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant={data.hasCriticalIssues ? 'error' : 'success'}>
                  Critical issues: {data.hasCriticalIssues ? 'yes' : 'none'}
                </Badge>
                <Badge variant={data.missedSubmissionWarnings > 0 ? 'warning' : 'success'}>
                  Missed warnings: {data.missedSubmissionWarnings}
                </Badge>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scoring}>
            Cancel
          </Button>
          <Button onClick={onConfirmScore} disabled={scoring || loading || !!error || (data?.hasCriticalIssues ?? true)}>
            {scoring ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scoring...
              </>
            ) : (
              'Confirm and Score'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
