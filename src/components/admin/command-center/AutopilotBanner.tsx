'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type DashboardData, type RoundEntry, getCountdown } from './command-center-types'

export interface AutopilotBannerProps {
  submissionProgress: DashboardData['submissionProgress']
  currentRound: DashboardData['currentRound']
  currentRoundEntry: RoundEntry | null
  deadlinePassed: boolean
  onAction: (action: string, endpoint: string) => void
  actionLoading: string | null
}

export function AutopilotBanner({
  submissionProgress,
  currentRound,
  currentRoundEntry,
  deadlinePassed,
  onAction,
  actionLoading,
}: AutopilotBannerProps) {
  const router = useRouter()

  const autopilotAction = (() => {
    if (submissionProgress.pending > 0) {
      return {
        label: 'Send reminders',
        reason: `${submissionProgress.pending} teams pending - Deadline in ${getCountdown(currentRound?.closesAt)}`,
        emphasis: 'warning' as const,
        onClick: () => onAction('reminder', '/api/admin/notifications/round-reminder'),
      }
    }
    if (deadlinePassed) {
      return {
        label: 'Process missed submissions',
        reason: 'Deadline passed - issue warnings for missed submissions',
        emphasis: 'error' as const,
        onClick: () => onAction('missed', '/api/admin/notifications/missed-submissions'),
      }
    }
    if (currentRoundEntry && !currentRoundEntry.hasActuals) {
      return {
        label: 'Upload actuals',
        reason: 'Actuals missing - upload actuals before scoring this round',
        emphasis: 'info' as const,
        href: '/admin/actuals',
      }
    }
    if (currentRoundEntry?.hasActuals && !currentRoundEntry.isScored) {
      return {
        label: 'Run scoring',
        reason: 'Actuals are uploaded - scoring is ready to run',
        emphasis: 'success' as const,
        href: '/admin/scoring',
      }
    }
    if (currentRoundEntry?.isScored) {
      return {
        label: 'Publish rankings',
        reason: 'Scoring is complete - review and publish rankings',
        emphasis: 'success' as const,
        onClick: () => router.push('/leaderboards'),
      }
    }
    return {
      label: 'View submissions',
      reason: 'No active round - review the submissions overview',
      emphasis: 'neutral' as const,
      href: '/admin/submissions',
    }
  })()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Play className="h-5 w-5 text-primary" />
          Next Actions
        </CardTitle>
        <CardDescription>Admin autopilot highlights the highest-priority task first.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-primary/15 bg-primary-soft/70 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={autopilotAction.emphasis}>Primary action</Badge>
            {currentRound && (
              <Badge variant="secondary">Round {currentRound.number}</Badge>
            )}
          </div>
          <div className="mt-3 text-lg font-semibold text-foreground">{autopilotAction.label}</div>
          <p className="mt-1 text-sm text-text-secondary">{autopilotAction.reason}</p>
          <div className="mt-4">
            {'href' in autopilotAction ? (
              <Button asChild>
                <Link href={autopilotAction.href as string}>{autopilotAction.label}</Link>
              </Button>
            ) : (
              <Button
                onClick={autopilotAction.onClick}
                disabled={actionLoading === 'reminder' || actionLoading === 'missed'}
              >
                {autopilotAction.label}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
