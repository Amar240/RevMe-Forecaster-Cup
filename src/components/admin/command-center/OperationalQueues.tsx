'use client'

import Link from 'next/link'
import { AlertTriangle, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData } from './command-center-types'

export interface OperationalQueuesProps {
  submissionProgress: DashboardData['submissionProgress']
  meta: DashboardData['meta']
  stats: DashboardData['stats']
  onAction: (action: string, endpoint: string) => Promise<void>
  actionLoading: string | null
}

export function OperationalQueues({
  submissionProgress,
  meta,
  stats,
  onAction,
  actionLoading,
}: OperationalQueuesProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <Zap className="h-5 w-5 text-accent" />
            Operational Queues
          </CardTitle>
          <CardDescription>Items that need attention right now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details open className="rounded-xl border border-border bg-surface-secondary p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-3">
              <div className="font-semibold text-foreground">
                Pending Submissions ({submissionProgress.pending})
              </div>
              <Badge variant="info">{submissionProgress.pending} pending</Badge>
            </summary>
            <div className="mt-2 text-sm text-text-secondary">
              View the submissions list for full team-level details.
            </div>
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/submissions">View submissions</Link>
              </Button>
            </div>
          </details>

          <details open className="rounded-xl border border-border bg-surface-secondary p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-3">
              <div className="font-semibold text-foreground">
                Team Approvals ({meta.pendingTeamApprovals ?? 'Not set'})
              </div>
              <Badge
                variant={meta.pendingTeamApprovals && meta.pendingTeamApprovals > 0 ? 'warning' : 'neutral'}
                title={meta.pendingTeamApprovals === null ? 'Data not available' : undefined}
              >
                {meta.pendingTeamApprovals ?? 'Not set'}
              </Badge>
            </summary>
            <div className="mt-2 text-sm text-text-secondary">
              Open Team Approvals to review pending requests.
            </div>
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/team-approvals">Review teams</Link>
              </Button>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Disqualification Risk
          </CardTitle>
          <CardDescription>Warnings and disqualification thresholds.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-surface-secondary p-3">
              <div className="text-xs text-text-muted">1 Warning</div>
              <div className="text-lg font-semibold text-foreground tabular-nums" title="Data not available">
                Not set
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface-secondary p-3">
              <div className="text-xs text-text-muted">2 Warnings</div>
              <div className="text-lg font-semibold text-foreground tabular-nums" title="Data not available">
                Not set
              </div>
            </div>
            <div className="rounded-xl border border-error/20 bg-error-background/60 p-3">
              <div className="text-xs text-text-muted">DQ (3+)</div>
              <div className="text-lg font-semibold text-foreground tabular-nums">
                {stats.disqualifiedTeams}
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm text-text-secondary">
            Total warnings issued:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {stats.totalWarnings}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction('missed', '/api/admin/notifications/missed-submissions')}
              disabled={actionLoading === 'missed'}
            >
              {actionLoading === 'missed' ? 'Processing...' : 'Process missed submissions'}
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/escalations">View at-risk teams</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
