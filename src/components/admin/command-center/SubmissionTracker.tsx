'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface TrackerTeam {
  id: string
  name: string
  displayId: string
  university: string
  supervisor: string
  supervisorEmail: string | null
  hasSubmitted: boolean
  submittedAt: string | null
}

interface TrackerData {
  round: { id: string; number: number; opensAt: string; closesAt: string } | null
  markets: { id: string; name: string }[]
  teams: TrackerTeam[]
  summary: { total: number; submitted: number; missing: number }
}

function getTimeRemaining(closesAt: string): { hours: number; minutes: number; passed: boolean } {
  const diffMs = new Date(closesAt).getTime() - Date.now()
  if (diffMs <= 0) return { hours: 0, minutes: 0, passed: true }
  return {
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
    passed: false,
  }
}

function TrackerTable({
  tone,
  teams,
  showSupervisor,
  showSubmittedAt,
}: {
  tone: 'error' | 'success' | 'neutral'
  teams: TrackerTeam[]
  showSupervisor?: boolean
  showSubmittedAt?: boolean
}) {
  const wrapperClass =
    tone === 'error'
      ? 'border-error/20 bg-error-background/60'
      : tone === 'success'
        ? 'border-success/20 bg-success-background/60'
        : 'border-border bg-card'

  const headClass =
    tone === 'error'
      ? 'border-error/20 bg-error-background text-error'
      : tone === 'success'
        ? 'border-success/20 bg-success-background text-success'
        : 'border-border bg-muted text-text-secondary'

  const bodyClass =
    tone === 'error'
      ? 'divide-error/10'
      : tone === 'success'
        ? 'divide-success/10'
        : 'divide-border'

  return (
    <div className={`overflow-hidden rounded-lg border ${wrapperClass}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b text-left text-xs uppercase tracking-[0.15em] ${headClass}`}>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">University</th>
              {showSupervisor && <th className="px-4 py-2">Supervisor</th>}
              {showSubmittedAt && <th className="px-4 py-2">Submitted At</th>}
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${bodyClass}`}>
            {teams.map((team) => (
              <tr key={team.id} className="transition-colors hover:bg-surface-secondary">
                <td className="px-4 py-2 font-medium text-foreground">
                  {team.name}
                  <span className="ml-2 text-xs text-text-muted">{team.displayId}</span>
                </td>
                <td className="px-4 py-2 text-text-secondary">{team.university}</td>
                {showSupervisor && (
                  <td className="px-4 py-2 text-text-secondary">
                    {team.supervisor}
                    {team.supervisorEmail ? (
                      <a
                        href={`mailto:${team.supervisorEmail}`}
                        className="ml-2 text-xs text-primary hover:text-primary-hover hover:underline"
                      >
                        {team.supervisorEmail}
                      </a>
                    ) : null}
                  </td>
                )}
                {showSubmittedAt && (
                  <td className="px-4 py-2 tabular-nums text-text-secondary">
                    {team.submittedAt
                      ? new Date(team.submittedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : '-'}
                  </td>
                )}
                <td className="px-4 py-2">
                  {team.hasSubmitted ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Submitted
                    </Badge>
                  ) : (
                    <Badge variant="error" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Missing
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TrackerBody({
  data,
  countdown,
  compact,
  reminderSent,
  sendingReminder,
  showSubmitted,
  setShowSubmitted,
  onSendReminder,
  onRefresh,
  loading,
}: {
  data: TrackerData
  countdown: { hours: number; minutes: number; passed: boolean } | null
  compact: boolean
  reminderSent: boolean
  sendingReminder: boolean
  showSubmitted: boolean
  setShowSubmitted: React.Dispatch<React.SetStateAction<boolean>>
  onSendReminder: () => Promise<void>
  onRefresh: () => Promise<void>
  loading: boolean
}) {
  const { summary, teams } = data
  const progressPercent =
    summary.total > 0 ? Math.round((summary.submitted / summary.total) * 100) : 0
  const deadlinePassed = countdown?.passed ?? false

  const sortedTeams = [...teams].sort((a, b) => {
    if (a.hasSubmitted === b.hasSubmitted) return a.name.localeCompare(b.name)
    return a.hasSubmitted ? 1 : -1
  })
  const missingTeams = sortedTeams.filter((team) => !team.hasSubmitted)
  const submittedTeams = sortedTeams.filter((team) => team.hasSubmitted)
  const visibleMissingTeams = compact ? missingTeams.slice(0, 6) : missingTeams
  const visibleSubmittedTeams = compact ? submittedTeams.slice(0, 6) : submittedTeams

  return (
    <div className="space-y-5">
      <div
        className={`rounded-xl border p-4 ${
          deadlinePassed
            ? 'border-error/20 bg-error-background/60'
            : 'border-primary/15 bg-primary-soft/70'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className={`text-sm font-medium ${deadlinePassed ? 'text-error' : 'text-primary'}`}>
              {deadlinePassed ? 'Deadline Passed' : 'Time Remaining'}
            </div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {deadlinePassed
                ? 'Deadline passed'
                : `${countdown?.hours ?? 0}h ${countdown?.minutes ?? 0}m left`}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              Deadline:{' '}
              {new Date(data.round!.closesAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-text-secondary">
              {summary.submitted} of {summary.total} teams submitted
            </div>
            <div className="text-3xl font-bold tabular-nums text-foreground">
              {progressPercent}%
            </div>
          </div>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-secondary">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              deadlinePassed ? 'bg-error' : 'bg-primary'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {missingTeams.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center text-sm font-semibold text-error">
                <XCircle className="mr-2 h-4 w-4" />
                Missing Submissions ({summary.missing})
              </h3>
              {compact && missingTeams.length > visibleMissingTeams.length ? (
                <p className="mt-1 text-xs text-text-muted">
                  Showing {visibleMissingTeams.length} of {missingTeams.length} missing teams
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => void onSendReminder()}
                disabled={sendingReminder || reminderSent}
              >
                {sendingReminder ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {reminderSent ? 'Reminders Sent' : 'Send Reminder'}
              </Button>
              {!compact ? (
                <Button size="sm" variant="outline" onClick={() => void onRefresh()} disabled={loading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              ) : null}
            </div>
          </div>
          <TrackerTable tone="error" teams={visibleMissingTeams} showSupervisor />
        </div>
      ) : null}

      {submittedTeams.length > 0 ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowSubmitted((value) => !value)}
            className="flex items-center text-sm font-semibold text-success transition-colors hover:opacity-80"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Submitted ({summary.submitted})
            <span className="ml-2 text-xs text-text-muted">
              {showSubmitted ? '(click to collapse)' : '(click to expand)'}
            </span>
          </button>
          {showSubmitted ? (
            <TrackerTable tone="success" teams={visibleSubmittedTeams} showSubmittedAt />
          ) : null}
        </div>
      ) : null}

      {compact ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3">
          <div className="text-sm text-text-secondary">
            Need more team-level detail? Open the full submissions explorer.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void onRefresh()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/submissions">Open explorer</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="flex items-center text-sm font-semibold text-foreground">
            <Send className="mr-2 h-4 w-4 text-primary" />
            All Teams Overview
          </h3>
          <TrackerTable tone="neutral" teams={sortedTeams} showSubmittedAt />
        </div>
      )}
    </div>
  )
}

export function SubmissionTracker({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reminderSent, setReminderSent] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [showSubmitted, setShowSubmitted] = useState(false)
  const [countdown, setCountdown] = useState<{
    hours: number
    minutes: number
    passed: boolean
  } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await csrfFetch('/api/admin/submissions/tracker')
      if (res.ok) {
        const result: TrackerData = await res.json()
        setData(result)
        setReminderSent(false)
        if (result.round) {
          setCountdown(getTimeRemaining(result.round.closesAt))
        }
      } else {
        toast.error('Failed to load submission tracker')
      }
    } catch (error) {
      clientLogger.error('Failed to fetch submission tracker:', error)
      toast.error('Failed to load submission tracker')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!data?.round) return

    const interval = setInterval(() => {
      setCountdown(getTimeRemaining(data.round!.closesAt))
    }, 60_000)

    return () => clearInterval(interval)
  }, [data?.round])

  const handleSendReminder = async () => {
    setSendingReminder(true)
    try {
      const res = await csrfFetch('/api/admin/notifications/missed-submissions', {
        method: 'POST',
      })
      const result = await res.json()
      if (res.ok) {
        toast.success(result.message || 'Reminders sent to missing teams')
        setReminderSent(true)
      } else {
        toast.error(result.message || 'Failed to send reminders')
      }
    } catch (error) {
      clientLogger.error('Failed to send reminders:', error)
      toast.error('Failed to send reminders')
    } finally {
      setSendingReminder(false)
    }
  }

  if (loading) {
    const skeleton = (
      <div className="space-y-4">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )

    if (compact) {
      return skeleton
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent>{skeleton}</CardContent>
      </Card>
    )
  }

  if (!data?.round) {
    const content = (
      <p className="text-sm text-text-secondary">
        No active round. The live tracker will appear when submissions open.
      </p>
    )

    if (compact) {
      return content
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-xl font-semibold">
            <Clock className="mr-2 h-5 w-5 text-text-muted" />
            Live Submission Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    )
  }

  const body = (
    <TrackerBody
      data={data}
      countdown={countdown}
      compact={compact}
      reminderSent={reminderSent}
      sendingReminder={sendingReminder}
      showSubmitted={showSubmitted}
      setShowSubmitted={setShowSubmitted}
      onSendReminder={handleSendReminder}
      onRefresh={fetchData}
      loading={loading}
    />
  )

  if (compact) {
    return body
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center text-xl font-semibold">
          <Clock className="mr-2 h-5 w-5 text-primary" />
          Live Submission Tracker - Round {data.round.number}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
