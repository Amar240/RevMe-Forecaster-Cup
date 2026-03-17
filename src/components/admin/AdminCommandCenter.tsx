'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ChevronRight, RefreshCw, Send, Users } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { DashboardData } from './command-center/command-center-types'
import { CommandCenterSkeleton } from './command-center/CommandCenterSkeleton'
import { AutopilotBanner } from './command-center/AutopilotBanner'
import { RoundLifecycle } from './command-center/RoundLifecycle'
import { SubmissionProgress } from './command-center/SubmissionProgress'
import { ActiveRoundCard } from './command-center/ActiveRoundCard'
import { OperationalQueues } from './command-center/OperationalQueues'
import { WeeklyChecklist } from './command-center/WeeklyChecklist'
import { CompetitionHealthScore } from './command-center/CompetitionHealthScore'
import { SubmissionTracker } from './command-center/SubmissionTracker'
import { ActivityFeed } from './command-center/ActivityFeed'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-text-muted">
      {children}
    </h2>
  )
}

export function AdminCommandCenter() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsSince, setSecondsSince] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/command-center')
      if (res.ok) {
        const result = await res.json()
        setData(result)
        setLastUpdated(new Date())
        setSecondsSince(0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch command center data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => void fetchData(), 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Seconds-since-update counter
  useEffect(() => {
    if (!lastUpdated) return
    const tick = setInterval(
      () => setSecondsSince(Math.floor((Date.now() - lastUpdated.getTime()) / 1000)),
      1000
    )
    return () => clearInterval(tick)
  }, [lastUpdated])

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

  const handleChecklistUpdate = async (
    field: 'leaderboardReviewed' | 'participantsNotified',
    value: boolean
  ) => {
    if (!data?.currentRound) return
    // Optimistic update
    setData((prev) =>
      prev
        ? {
            ...prev,
            currentRound: prev.currentRound
              ? { ...prev.currentRound, [field]: value }
              : null,
          }
        : prev
    )
    try {
      const res = await csrfFetch(`/api/admin/rounds/${data.currentRound.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      })
      if (!res.ok) {
        toast.error('Failed to save checklist item')
        void fetchData()
      }
    } catch {
      toast.error('Failed to save checklist item')
      void fetchData()
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
  const deadlinePassed = data.currentRound
    ? new Date(data.currentRound.closesAt).getTime() < Date.now()
    : false

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {data.activeSeason
              ? `${data.activeSeason.name} - ${data.activeSeason.status}`
              : 'No active season'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-sm text-text-secondary">
            Season:{' '}
            <span className="font-semibold text-foreground">
              {data.activeSeason?.name ?? 'None'}
            </span>
          </div>
          {lastUpdated && (
            <span className="text-xs text-text-muted">Updated {secondsSince}s ago</span>
          )}
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ══ Zone 1 — Right Now ══ */}
      <div>
        <SectionLabel>Right Now</SectionLabel>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <WeeklyChecklist
            currentRound={data.currentRound}
            submissionProgress={data.submissionProgress}
            currentRoundEntry={currentRoundEntry}
            meta={data.meta}
            stats={data.stats}
            leaderboardReviewed={data.currentRound?.leaderboardReviewed ?? false}
            participantsNotified={data.currentRound?.participantsNotified ?? false}
            onChecklistUpdate={handleChecklistUpdate}
          />
          <AutopilotBanner
            submissionProgress={data.submissionProgress}
            currentRound={data.currentRound}
            currentRoundEntry={currentRoundEntry}
            deadlinePassed={deadlinePassed}
            onAction={handleAction}
            actionLoading={actionLoading}
          />
        </div>
        {data.currentRound && (
          <div className="mt-6">
            <SubmissionTracker />
          </div>
        )}
      </div>

      {/* ══ Zone 2 — Competition Status ══ */}
      <div className="border-t border-border pt-6">
        <SectionLabel>Competition Status</SectionLabel>

        {/* 4 metric cards */}
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
              <p className="text-4xl font-semibold tabular-nums text-success">
                {data.submissionProgress.submitted}
              </p>
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

        <div className="mt-6">
          <SubmissionProgress
            stats={data.stats}
            meta={data.meta}
            submissionProgress={data.submissionProgress}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CompetitionHealthScore
            stats={data.stats}
            submissionProgress={data.submissionProgress}
            meta={data.meta}
          />
          <ActiveRoundCard
            currentRound={data.currentRound}
            currentRoundEntry={currentRoundEntry}
            submissionProgress={data.submissionProgress}
            meta={data.meta}
          />
        </div>

        <div className="mt-6">
          <OperationalQueues
            submissionProgress={data.submissionProgress}
            meta={data.meta}
            stats={data.stats}
          />
        </div>
      </div>

      {/* ══ Zone 3 — History & Tools (collapsible) ══ */}
      <div className="border-t border-border pt-6">
        <details>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3 w-3 transition-transform [[open]_&]:rotate-90" />
            History &amp; Tools
          </summary>
          <div className="mt-6 space-y-6">
            <RoundLifecycle rounds={data.rounds} onAction={handleAction} actionLoading={actionLoading} />
            <ActivityFeed />
          </div>
        </details>
      </div>
    </div>
  )
}
