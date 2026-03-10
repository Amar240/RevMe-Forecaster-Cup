'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import type { DashboardData, RoundEntry } from './command-center-types'
import { getCountdown } from './command-center-types'

export interface ActiveRoundCardProps {
  currentRound: DashboardData['currentRound']
  currentRoundEntry: RoundEntry | null
  submissionProgress: DashboardData['submissionProgress']
  meta: DashboardData['meta']
  canSendReminders: boolean
  canUploadActuals: boolean
  canRunScoring: boolean
  onAction: (action: string, endpoint: string) => Promise<void>
  actionLoading: string | null
}

export function ActiveRoundCard({
  currentRound,
  currentRoundEntry,
  submissionProgress,
  meta,
  canSendReminders,
  canUploadActuals,
  canRunScoring,
  onAction,
  actionLoading,
}: ActiveRoundCardProps) {
  const submissionPercent = submissionProgress.total > 0
    ? Math.round((submissionProgress.submitted / submissionProgress.total) * 100)
    : 0

  return (
    <Card className="border-gray-200">
      <CardContent className="p-5 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Active Round</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {currentRound ? `Round ${currentRound.number}` : 'No Active Round'}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-medium text-sm">
              {currentRound ? currentRound.status : 'Not Scheduled'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium text-xs" title={!currentRound ? 'Data not available' : undefined}>
              Deadline (ET): {currentRound ? new Date(currentRound.closesAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
              }) : 'Not scheduled'}
            </span>
            <span className="px-3 py-1 rounded-full bg-zinc-100 text-zinc-700 font-medium text-xs" title={meta.weekOffsets.length === 0 ? 'Data not available' : undefined}>
              Week Offsets: {meta.weekOffsets.length > 0 ? meta.weekOffsets.join(', ') : 'Not set'}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium text-xs">
              Time Remaining: {getCountdown(currentRound?.closesAt)}
            </span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Submission Progress</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {submissionProgress.submitted} / {submissionProgress.total}
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-blue-600" style={{ width: `${submissionPercent}%` }} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Last Scoring Run</div>
              <div className="mt-1 font-semibold text-gray-900">
                {meta.lastScoredAt
                  ? new Date(meta.lastScoredAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : 'Not set'}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Last Actuals Upload</div>
              <div className="mt-1 font-semibold text-gray-900">
                {meta.lastActualsUploadAt ? new Date(meta.lastActualsUploadAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : (currentRoundEntry?.hasActuals ? 'Actuals uploaded' : 'Not set')}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-zinc-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-400">Round Lifecycle</div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              {['Open', 'Lock Submissions', 'Upload Actuals', 'Run Scoring', 'Publish Rankings'].map((step, index) => {
                const activeIndex = currentRoundEntry?.isScored ? 4
                  : currentRoundEntry?.hasActuals ? 2
                  : currentRound?.status === 'Closed' ? 1 : 0
                const isActive = index <= activeIndex
                return (
                  <div key={step} className={`flex items-center gap-2 ${isActive ? 'text-blue-700' : 'text-gray-400'}`}>
                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-blue-600' : 'bg-gray-300'}`} />
                    <span>{step}</span>
                    {index < 4 && <ChevronRight className="h-3 w-3 text-gray-300" />}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/team-approvals">View pending teams</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAction('reminder', '/api/admin/notifications/round-reminder')}
              disabled={!canSendReminders || actionLoading === 'reminder'}
            >
              Send reminders
            </Button>
            <Button variant="outline" size="sm" disabled={!canUploadActuals} onClick={() => window.location.assign('/admin/actuals')}>
              Upload actuals
            </Button>
            <Button variant="outline" size="sm" disabled={!canRunScoring} onClick={() => window.location.assign('/admin/scoring')}>
              Run scoring
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.assign('/leaderboards')}>
              Publish rankings
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
