'use client'

import { useEffect, useState } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'

interface RoundActuals {
  roundNumber: number
  uploaded: number
  expected: number
  complete: boolean
}

interface PreflightData {
  rounds: RoundActuals[]
  totalActiveTeams: number
  teamsSubmitted: number
  missedSubmissionWarnings: number
  teamsAtRiskOfDQ: number
  hasCriticalIssues: boolean
}

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
      return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
    case 'fail':
      return <XCircle className="h-5 w-5 text-red-600 shrink-0" />
    case 'warn':
      return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PreflightCheck({ open, onOpenChange, onConfirmScore, scoring }: PreflightCheckProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PreflightData | null>(null)
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
        if (!cancelled) setData(json)
      } catch (err) {
        clientLogger.error('Preflight fetch failed:', err)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load preflight data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPreflight()
    return () => { cancelled = true }
  }, [open])

  const allChecksPassed = data !== null && !data.hasCriticalIssues && data.teamsAtRiskOfDQ === 0 && data.missedSubmissionWarnings === 0
  const hasWarnings = data !== null && !data.hasCriticalIssues && (data.teamsAtRiskOfDQ > 0 || data.missedSubmissionWarnings > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scoring Preflight Check</DialogTitle>
          <DialogDescription>
            Review data readiness before running scoring.
          </DialogDescription>
        </DialogHeader>

        {loading && <LoadingSkeleton />}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* Status banner */}
            {allChecksPassed && (
              <div className="rounded-md border border-green-200 bg-green-50 p-3 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-800">All checks passed</p>
              </div>
            )}
            {hasWarnings && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-sm font-medium text-amber-800">Review issues before scoring</p>
              </div>
            )}
            {data.hasCriticalIssues && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-red-600 shrink-0" />
                <p className="text-sm font-medium text-red-800">Critical issues must be resolved before scoring</p>
              </div>
            )}

            {/* DQ warning banner */}
            {data.teamsAtRiskOfDQ > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">{data.teamsAtRiskOfDQ} team{data.teamsAtRiskOfDQ === 1 ? '' : 's'}</span>{' '}
                  at risk of disqualification
                </p>
              </div>
            )}

            {/* Checks list */}
            <div className="space-y-3">
              {/* Actuals coverage per round */}
              {data.rounds.map((round) => {
                const status: CheckStatus = round.complete ? 'pass' : 'fail'
                return (
                  <div key={round.roundNumber} className="flex items-center gap-3">
                    <StatusIcon status={status} />
                    <span className="text-sm text-gray-800">
                      Round {round.roundNumber}: {round.uploaded}/{round.expected} actuals uploaded
                      {!round.complete && (
                        <span className="ml-1.5 font-semibold text-red-600">— INCOMPLETE</span>
                      )}
                    </span>
                  </div>
                )
              })}

              {/* Submission coverage */}
              {(() => {
                const subStatus: CheckStatus =
                  data.teamsSubmitted === data.totalActiveTeams
                    ? 'pass'
                    : data.teamsSubmitted / data.totalActiveTeams >= 0.8
                      ? 'warn'
                      : 'fail'
                return (
                  <div className="flex items-center gap-3">
                    <StatusIcon status={subStatus} />
                    <span className="text-sm text-gray-800">
                      {data.teamsSubmitted}/{data.totalActiveTeams} active teams submitted
                    </span>
                  </div>
                )
              })()}

              {/* Missed submission warnings */}
              {(() => {
                const warnStatus: CheckStatus = data.missedSubmissionWarnings === 0 ? 'pass' : 'warn'
                return (
                  <div className="flex items-center gap-3">
                    <StatusIcon status={warnStatus} />
                    <span className="text-sm text-gray-800">
                      {data.missedSubmissionWarnings} team{data.missedSubmissionWarnings === 1 ? '' : 's'} will receive missed-submission warnings
                    </span>
                  </div>
                )
              })()}

              {/* Teams at risk of DQ */}
              {(() => {
                const dqStatus: CheckStatus = data.teamsAtRiskOfDQ === 0 ? 'pass' : 'warn'
                return (
                  <div className="flex items-center gap-3">
                    <StatusIcon status={dqStatus} />
                    <span className="text-sm text-gray-800">
                      {data.teamsAtRiskOfDQ} team{data.teamsAtRiskOfDQ === 1 ? '' : 's'} at risk of disqualification
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={scoring}>
            Cancel
          </Button>
          <Button
            onClick={onConfirmScore}
            disabled={scoring || loading || !!error || (data?.hasCriticalIssues ?? true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {scoring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scoring…
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
