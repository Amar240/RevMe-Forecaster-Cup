'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DashboardData, RoundEntry } from './command-center-types'
import { getCountdown } from './command-center-types'

export interface ActiveRoundCardProps {
  currentRound: DashboardData['currentRound']
  currentRoundEntry: RoundEntry | null
  submissionProgress: DashboardData['submissionProgress']
  meta: DashboardData['meta']
}

export function ActiveRoundCard({
  currentRound,
  currentRoundEntry,
  submissionProgress,
  meta,
}: ActiveRoundCardProps) {
  const submissionPercent =
    submissionProgress.total > 0 ? Math.round((submissionProgress.submitted / submissionProgress.total) * 100) : 0

  return (
    <Card>
      <CardContent className="grid gap-6 p-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Active Round</div>
              <div className="mt-1 text-lg font-semibold text-foreground">
                {currentRound ? `Round ${currentRound.number}` : 'No Active Round'}
              </div>
            </div>
            <Badge variant={currentRound ? 'info' : 'neutral'} className="px-3 py-1 text-sm font-medium">
              {currentRound ? currentRound.status : 'Not Scheduled'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
              Deadline (ET):{' '}
              {currentRound
                ? new Date(currentRound.closesAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                  })
                : 'Not scheduled'}
            </Badge>
            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium">
              Week Offsets: {meta.weekOffsets.length > 0 ? meta.weekOffsets.join(', ') : 'Not set'}
            </Badge>
            <Badge variant="success" className="px-3 py-1 text-xs font-medium">
              Time Remaining: {getCountdown(currentRound?.closesAt)}
            </Badge>
          </div>

          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between text-sm text-text-secondary">
              <span>Submission Progress</span>
              <span className="font-semibold tabular-nums text-foreground">
                {submissionProgress.submitted} / {submissionProgress.total}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${submissionPercent}%` }} />
            </div>
          </div>

          <div className="grid gap-3 text-sm text-text-secondary sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Last Scoring Run</div>
              <div className="mt-1 font-semibold text-foreground">
                {meta.lastScoredAt
                  ? new Date(meta.lastScoredAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : 'Not set'}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Last Actuals Upload</div>
              <div className="mt-1 font-semibold text-foreground">
                {meta.lastActualsUploadAt
                  ? new Date(meta.lastActualsUploadAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : currentRoundEntry?.hasActuals
                    ? 'Actuals uploaded'
                    : 'Not set'}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-text-muted">Round Lifecycle</div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
              {['Open', 'Lock Submissions', 'Upload Actuals', 'Run Scoring', 'Publish Rankings'].map((step, index) => {
                const activeIndex = currentRoundEntry?.isScored ? 4 : currentRoundEntry?.hasActuals ? 2 : currentRound?.status === 'Closed' ? 1 : 0
                const isActive = index <= activeIndex
                return (
                  <div key={step} className={`flex items-center gap-2 ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-primary' : 'bg-border'}`} />
                    <span>{step}</span>
                    {index < 4 && <ChevronRight className="h-3 w-3 text-border-strong" />}
                  </div>
                )
              })}
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/admin/team-approvals">View pending teams</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
