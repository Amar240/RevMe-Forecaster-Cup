'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Zap, AlertTriangle } from 'lucide-react'
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
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl font-semibold">
            <Zap className="h-5 w-5 mr-2 text-amber-500" />
            Operational Queues
          </CardTitle>
          <CardDescription>Items that need attention right now</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <details open className="rounded-lg border border-gray-200 p-4">
            <summary className="flex items-center justify-between cursor-pointer">
              <div className="font-semibold text-gray-900">Pending Submissions ({submissionProgress.pending})</div>
              <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded-full">
                {submissionProgress.pending} pending
              </span>
            </summary>
            <div className="mt-2 text-sm text-gray-500">View the submissions list for full team-level details.</div>
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/submissions">View submissions</Link>
              </Button>
            </div>
          </details>
          <details open className="rounded-lg border border-gray-200 p-4">
            <summary className="flex items-center justify-between cursor-pointer">
              <div className="font-semibold text-gray-900">Team Approvals ({meta.pendingTeamApprovals ?? 'Not set'})</div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-full" title={meta.pendingTeamApprovals === null ? 'Data not available' : undefined}>
                {meta.pendingTeamApprovals ?? 'Not set'}
              </span>
            </summary>
            <div className="mt-2 text-sm text-gray-500">Open Team Approvals to review pending requests.</div>
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
          <CardTitle className="flex items-center text-xl font-semibold">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
            Disqualification Risk
          </CardTitle>
          <CardDescription>Warnings and disqualification thresholds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">1 Warning</div>
              <div className="text-lg font-semibold text-gray-900 tabular-nums" title="Data not available">Not set</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">2 Warnings</div>
              <div className="text-lg font-semibold text-gray-900 tabular-nums" title="Data not available">Not set</div>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">DQ (3+)</div>
              <div className="text-lg font-semibold text-gray-900 tabular-nums">{stats.disqualifiedTeams}</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Total warnings issued: <span className="font-semibold tabular-nums">{stats.totalWarnings}</span>
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
