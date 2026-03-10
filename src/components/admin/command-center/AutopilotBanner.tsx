import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'
import { type DashboardData, type RoundEntry, getCountdown } from './command-center-types'

export interface AutopilotBannerProps {
  submissionProgress: DashboardData['submissionProgress']
  currentRound: DashboardData['currentRound']
  currentRoundEntry: RoundEntry | null
  deadlinePassed: boolean
  canSendReminders: boolean
  canUploadActuals: boolean
  canRunScoring: boolean
  onAction: (action: string, endpoint: string) => void
  actionLoading: string | null
}

export function AutopilotBanner({
  submissionProgress,
  currentRound,
  currentRoundEntry,
  deadlinePassed,
  canSendReminders,
  canUploadActuals,
  canRunScoring,
  onAction,
  actionLoading,
}: AutopilotBannerProps) {
  const autopilotAction = (() => {
    if (submissionProgress.pending > 0) {
      return {
        label: 'Send reminders',
        reason: `${submissionProgress.pending} teams pending - Deadline in ${getCountdown(currentRound?.closesAt)}`,
        onClick: () => onAction('reminder', '/api/admin/notifications/round-reminder'),
      }
    }
    if (deadlinePassed) {
      return {
        label: 'Process missed submissions',
        reason: 'Deadline passed - Issue warnings for missed submissions',
        onClick: () => onAction('missed', '/api/admin/notifications/missed-submissions'),
      }
    }
    if (currentRoundEntry && !currentRoundEntry.hasActuals) {
      return {
        label: 'Upload actuals',
        reason: 'Actuals missing - Upload actuals to score this round',
        href: '/admin/actuals',
      }
    }
    if (currentRoundEntry?.hasActuals && !currentRoundEntry.isScored) {
      return {
        label: 'Run scoring',
        reason: 'Actuals uploaded - Scores not computed yet',
        href: '/admin/scoring',
      }
    }
    if (currentRoundEntry?.isScored) {
      return {
        label: 'Publish rankings',
        reason: 'Scoring complete - Publish rankings',
        onClick: () => { window.location.assign('/leaderboards') },
      }
    }
    return {
      label: 'View submissions',
      reason: 'No active round - Review submissions overview',
      href: '/admin/submissions',
    }
  })()

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-semibold">
          <Play className="h-5 w-5 mr-2 text-blue-600" />
          Next Actions
        </CardTitle>
        <CardDescription>Admin autopilot selects the highest-priority task</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm font-medium text-blue-700">Primary action</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">{autopilotAction.label}</div>
          <div className="text-sm text-gray-500 mt-1">{autopilotAction.reason}</div>
          <div className="mt-4">
            {autopilotAction.href ? (
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                <Link href={autopilotAction.href}>{autopilotAction.label}</Link>
              </Button>
            ) : (
              <Button onClick={autopilotAction.onClick} className="bg-blue-600 hover:bg-blue-700 text-white">
                {autopilotAction.label}
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('reminder', '/api/admin/notifications/round-reminder')}
            disabled={!canSendReminders || actionLoading === 'reminder'}
          >
            Send reminders
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction('missed', '/api/admin/notifications/missed-submissions')}
            disabled={actionLoading === 'missed'}
          >
            Process missed submissions
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canUploadActuals}
            onClick={() => window.location.assign('/admin/actuals')}
          >
            Upload actuals
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canRunScoring}
            onClick={() => window.location.assign('/admin/scoring')}
          >
            Run scoring
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.assign('/leaderboards')}
          >
            Publish rankings
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
