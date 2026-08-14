'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock, Mail, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface TeamRow {
  id: string
  name: string
  displayId: string
  university: string
  supervisor: string
  supervisorEmail: string | null
}

interface TrackerData {
  openRound: { id: string; number: number; opensAt: string; closesAt: string } | null
  openTeams: (TeamRow & { hasSubmitted: boolean; submittedAt: string | null })[]
  openSummary: { total: number; submitted: number; pending: number }
  missedRound: { id: string; number: number; closesAt: string } | null
  missedTeams: TeamRow[]
  markets: { id: string; name: string }[]
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

function TrackerBody({
  data,
  countdown,
  sendingReminder,
  reminderSent,
  onSendReminder,
}: {
  data: TrackerData
  countdown: { hours: number; minutes: number; passed: boolean } | null
  sendingReminder: boolean
  reminderSent: boolean
  onSendReminder: () => Promise<void>
}) {
  const { openRound, openSummary, missedRound, missedTeams } = data
  const progressPercent = openSummary.total > 0 ? Math.round((openSummary.submitted / openSummary.total) * 100) : 0
  const pendingTeams = data.openTeams.filter((t) => !t.hasSubmitted)

  return (
    <div className="space-y-5">
      {/* Current round — progress only; not-yet-submitted is neutral, never alarming, while time remains. */}
      {openRound ? (
        <div className="rounded-xl border border-border bg-surface-secondary/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Round {openRound.number} · in progress</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {countdown?.passed ? 'Deadline reached' : `${countdown?.hours ?? 0}h ${countdown?.minutes ?? 0}m left`}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                Closes {new Date(openRound.closesAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-text-secondary">{openSummary.submitted} of {openSummary.total} submitted</p>
              <p className="text-3xl font-semibold tabular-nums text-foreground">{progressPercent}%</p>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          {pendingTeams.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-text-secondary">
                Not yet submitted ({pendingTeams.length}) — still within the deadline:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pendingTeams.map((team) => (
                  <span key={team.id} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-text-secondary">
                    {team.name}
                  </span>
                ))}
              </div>
            </div>
          ) : openSummary.total > 0 ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> All teams have submitted.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Real misses — teams that did not submit for the most recent CLOSED round. This is the only red. */}
      {missedRound && missedTeams.length > 0 ? (
        <div className="rounded-xl border border-error/20 bg-error-background/50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-error">Missed Round {missedRound.number} ({missedTeams.length})</p>
              <p className="mt-0.5 text-xs text-text-muted">These teams had no submission when the round closed.</p>
            </div>
            <Button
              size="sm"
              variant="danger"
              onClick={() => void onSendReminder()}
              disabled={sendingReminder || reminderSent}
            >
              {sendingReminder ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              {reminderSent ? 'Warnings sent' : 'Send warning'}
            </Button>
          </div>
          <ul className="mt-3 divide-y divide-error/10">
            {missedTeams.map((team) => (
              <li key={team.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="font-medium text-foreground">
                  {team.name}
                  <span className="ml-2 text-xs text-text-muted">{team.university}</span>
                </span>
                {team.supervisorEmail ? (
                  <a href={`mailto:${team.supervisorEmail}`} className="text-xs text-primary hover:underline">
                    {team.supervisor}
                  </a>
                ) : (
                  <span className="text-xs text-text-muted">{team.supervisor}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!openRound && (!missedRound || missedTeams.length === 0) ? (
        <p className="text-sm text-text-secondary">No round is currently open, and no teams missed the last round.</p>
      ) : null}
    </div>
  )
}

export function SubmissionTracker({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reminderSent, setReminderSent] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; passed: boolean } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await csrfFetch('/api/admin/submissions/tracker')
      if (res.ok) {
        const result: TrackerData = await res.json()
        setData(result)
        setReminderSent(false)
        setCountdown(result.openRound ? getTimeRemaining(result.openRound.closesAt) : null)
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
    if (!data?.openRound) return
    const interval = setInterval(() => {
      setCountdown(getTimeRemaining(data.openRound!.closesAt))
    }, 60_000)
    return () => clearInterval(interval)
  }, [data?.openRound])

  const handleSendReminder = async () => {
    setSendingReminder(true)
    try {
      const res = await csrfFetch('/api/admin/notifications/missed-submissions', { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        toast.success(result.message || 'Warnings sent to missing teams')
        setReminderSent(true)
      } else {
        toast.error(result.message || 'Failed to send warnings')
      }
    } catch (error) {
      clientLogger.error('Failed to send reminders:', error)
      toast.error('Failed to send warnings')
    } finally {
      setSendingReminder(false)
    }
  }

  if (loading) {
    const skeleton = (
      <div className="space-y-4">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
    if (compact) return skeleton
    return (
      <Card>
        <CardHeader><CardTitle><Skeleton className="h-6 w-48" /></CardTitle></CardHeader>
        <CardContent>{skeleton}</CardContent>
      </Card>
    )
  }

  if (!data) {
    const content = <p className="text-sm text-text-secondary">The live tracker will appear when submissions open.</p>
    if (compact) return content
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center text-xl font-semibold"><Clock className="mr-2 h-5 w-5 text-text-muted" /> Live Submission Tracker</CardTitle></CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    )
  }

  const body = (
    <div className="space-y-4">
      <TrackerBody
        data={data}
        countdown={countdown}
        sendingReminder={sendingReminder}
        reminderSent={reminderSent}
        onSendReminder={handleSendReminder}
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => void fetchData()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/admin/submissions">Open explorer</Link>
        </Button>
      </div>
    </div>
  )

  if (compact) return body

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center text-xl font-semibold">
          <Clock className="mr-2 h-5 w-5 text-primary" /> Live Submission Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
