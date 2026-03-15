'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, FileText, RefreshCw, Send, Trophy, Users } from 'lucide-react'
import type { DashboardData } from './command-center/command-center-types'
import { CommandCenterSkeleton } from './command-center/CommandCenterSkeleton'
import { QuickActionCard } from './command-center/QuickActionCard'
import { AutopilotBanner } from './command-center/AutopilotBanner'
import { RoundLifecycle } from './command-center/RoundLifecycle'
import { SubmissionProgress } from './command-center/SubmissionProgress'
import { ActiveRoundCard } from './command-center/ActiveRoundCard'
import { OperationalQueues } from './command-center/OperationalQueues'
import { WeeklyChecklist } from './command-center/WeeklyChecklist'
import { CompetitionHealthScore } from './command-center/CompetitionHealthScore'
import { SubmissionTracker } from './command-center/SubmissionTracker'
import { ActivityFeed } from './command-center/ActivityFeed'

export function AdminCommandCenter() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/command-center')
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch command center data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleAction = async (action: string, endpoint: string) => {
    setActionLoading(action)
    try {
      const res = await csrfFetch(endpoint, { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        toast.success(result.message || 'Action completed')
        void fetchData()
      } else {
        toast.error(result.message || 'Action failed')
      }
    } catch (error) {
      clientLogger.error('Action failed:', error)
      toast.error('Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <CommandCenterSkeleton />

  if (!data) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Failed to load admin dashboard data</p>
        <Button onClick={fetchData} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  const currentRoundEntry = data.currentRound
    ? data.rounds.find((round) => round.id === data.currentRound?.id) ?? null
    : null
  const deadlinePassed = data.currentRound ? new Date(data.currentRound.closesAt).getTime() < Date.now() : false
  const canSendReminders = data.submissionProgress.pending > 0
  const canUploadActuals = currentRoundEntry ? !currentRoundEntry.hasActuals : true
  const canRunScoring = currentRoundEntry ? currentRoundEntry.hasActuals && !currentRoundEntry.isScored : true

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {data.activeSeason ? `${data.activeSeason.name} - ${data.activeSeason.status}` : 'No active season'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px]">
            <Input placeholder="Search teams, users, universities..." />
            <div className="mt-1 text-xs text-text-muted">
              Search is not available on this page. Go to{' '}
              <Link href="/admin/users" className="text-primary hover:text-primary-hover">
                Users
              </Link>{' '}
              or{' '}
              <Link href="/admin/teams" className="text-primary hover:text-primary-hover">
                Teams
              </Link>
              .
            </div>
          </div>
          <Select defaultValue={data.activeSeason?.id || ''} aria-label="Season selector">
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={data.activeSeason?.id || 'none'}>
                {data.activeSeason?.name || 'No active season'}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <WeeklyChecklist
        currentRound={data.currentRound}
        submissionProgress={data.submissionProgress}
        currentRoundEntry={currentRoundEntry}
        meta={data.meta}
        stats={data.stats}
      />

      <ActiveRoundCard
        currentRound={data.currentRound}
        currentRoundEntry={currentRoundEntry}
        submissionProgress={data.submissionProgress}
        meta={data.meta}
        canSendReminders={canSendReminders}
        canUploadActuals={canUploadActuals}
        canRunScoring={canRunScoring}
        onAction={handleAction}
        actionLoading={actionLoading}
      />

      {data.currentRound && <SubmissionTracker />}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card variant="metric" className="border-primary/10 bg-gradient-to-br from-primary-soft to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Users className="mr-2 h-4 w-4 text-primary" />
              Active Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums text-primary">{data.stats.activeTeams}</p>
            {data.stats.disqualifiedTeams > 0 && (
              <p className="text-xs text-text-secondary">{data.stats.disqualifiedTeams} disqualified</p>
            )}
          </CardContent>
        </Card>

        <Card variant="metric" className="border-success/10 bg-gradient-to-br from-success-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Send className="mr-2 h-4 w-4 text-success" />
              This Round
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums text-success">{data.submissionProgress.submitted}</p>
            <p className="text-xs text-text-secondary">of {data.submissionProgress.total} teams</p>
          </CardContent>
        </Card>

        <Card variant="metric" className="border-warning/10 bg-gradient-to-br from-warning-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <AlertTriangle className="mr-2 h-4 w-4 text-warning" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums text-warning">{data.stats.totalWarnings}</p>
            <p className="text-xs text-text-secondary">total issued</p>
          </CardContent>
        </Card>

        <Card variant="metric" className="border-info/10 bg-gradient-to-br from-info-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Users className="mr-2 h-4 w-4 text-info" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tabular-nums text-info">{data.stats.totalUsers}</p>
            <p className="text-xs text-text-secondary">registered</p>
          </CardContent>
        </Card>
      </div>

      <AutopilotBanner
        submissionProgress={data.submissionProgress}
        currentRound={data.currentRound}
        currentRoundEntry={currentRoundEntry}
        deadlinePassed={deadlinePassed}
        canSendReminders={canSendReminders}
        canUploadActuals={canUploadActuals}
        canRunScoring={canRunScoring}
        onAction={handleAction}
        actionLoading={actionLoading}
      />

      <SubmissionProgress stats={data.stats} meta={data.meta} submissionProgress={data.submissionProgress} />

      <CompetitionHealthScore stats={data.stats} submissionProgress={data.submissionProgress} meta={data.meta} />

      <OperationalQueues
        submissionProgress={data.submissionProgress}
        meta={data.meta}
        stats={data.stats}
        onAction={handleAction}
        actionLoading={actionLoading}
      />

      <RoundLifecycle rounds={data.rounds} onAction={handleAction} actionLoading={actionLoading} />

      <ActivityFeed />

      <div className="grid gap-6 lg:grid-cols-3">
        <QuickActionCard icon={FileText} title="Submissions Explorer" description="Browse and export all submissions" href="/admin/submissions" />
        <QuickActionCard icon={Trophy} title="Rankings" description="View and publish rankings" href="/leaderboards" />
        <QuickActionCard icon={FileText} title="Audit Logs" description="View admin action history" href="/admin/audit-logs" />
      </div>
    </div>
  )
}
