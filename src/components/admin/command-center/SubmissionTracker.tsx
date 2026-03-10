'use client'

import { useEffect, useState, useCallback } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Clock, Send, CheckCircle2, XCircle, RefreshCw, Mail } from 'lucide-react'

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

export function SubmissionTracker() {
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reminderSent, setReminderSent] = useState(false)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [showSubmitted, setShowSubmitted] = useState(false)
  const [countdown, setCountdown] = useState<{ hours: number; minutes: number; passed: boolean } | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await csrfFetch('/api/admin/submissions/tracker')
      if (res.ok) {
        const result: TrackerData = await res.json()
        setData(result)
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
    fetchData()
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
      const res = await csrfFetch('/api/admin/notifications/missed-submissions', { method: 'POST' })
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
    return (
      <Card className="border-gray-200 animate-pulse">
        <CardHeader><CardTitle className="h-6 w-48 bg-gray-200 rounded" /></CardHeader>
        <CardContent className="space-y-4">
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="h-3 w-full bg-gray-200 rounded" />
          <div className="h-32 w-full bg-gray-100 rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!data?.round) {
    return (
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center text-xl font-semibold">
            <Clock className="h-5 w-5 mr-2 text-gray-400" />
            Live Submission Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No active round. The tracker will appear when a round is open.</p>
        </CardContent>
      </Card>
    )
  }

  const { summary, teams } = data
  const progressPercent = summary.total > 0 ? Math.round((summary.submitted / summary.total) * 100) : 0
  const deadlinePassed = countdown?.passed ?? false

  const sortedTeams = [...teams].sort((a, b) => {
    if (a.hasSubmitted === b.hasSubmitted) return a.name.localeCompare(b.name)
    return a.hasSubmitted ? 1 : -1
  })
  const missingTeams = sortedTeams.filter((t) => !t.hasSubmitted)
  const submittedTeams = sortedTeams.filter((t) => t.hasSubmitted)

  return (
    <Card className={`border-gray-200 ${deadlinePassed ? 'border-red-200' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center text-xl font-semibold">
          <Clock className={`h-5 w-5 mr-2 ${deadlinePassed ? 'text-red-500' : 'text-blue-600'}`} />
          Live Submission Tracker — Round {data.round.number}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Countdown + Progress banner */}
        <div className={`rounded-xl border p-4 ${deadlinePassed ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className={`text-sm font-medium ${deadlinePassed ? 'text-red-700' : 'text-blue-700'}`}>
                {deadlinePassed ? 'Deadline Passed' : 'Time Remaining'}
              </div>
              <div className={`text-2xl font-bold tabular-nums ${deadlinePassed ? 'text-red-600' : 'text-gray-900'}`}>
                {deadlinePassed
                  ? 'Deadline passed'
                  : `${countdown!.hours}h ${countdown!.minutes}m left`}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Deadline: {new Date(data.round.closesAt).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-700">
                {summary.submitted} of {summary.total} teams submitted
              </div>
              <div className="text-3xl font-bold tabular-nums text-gray-900">{progressPercent}%</div>
            </div>
          </div>
          <div className="mt-3 h-3 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${deadlinePassed ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Missing teams section */}
        {missingTeams.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center text-sm font-semibold text-red-700">
                <XCircle className="h-4 w-4 mr-2" />
                Missing Submissions ({summary.missing})
              </h3>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleSendReminder}
                disabled={sendingReminder || reminderSent}
              >
                {sendingReminder ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                {reminderSent ? 'Reminders Sent' : 'Send Reminder to Missing Teams'}
              </Button>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red-200 bg-red-50 text-left text-xs uppercase tracking-[0.15em] text-red-700">
                      <th className="px-4 py-2">Team</th>
                      <th className="px-4 py-2">University</th>
                      <th className="px-4 py-2">Supervisor</th>
                      <th className="px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {missingTeams.map((team) => (
                      <tr key={team.id} className="hover:bg-red-50/80">
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {team.name}
                          <span className="ml-2 text-xs text-gray-400">{team.displayId}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{team.university}</td>
                        <td className="px-4 py-2 text-gray-600">
                          {team.supervisor}
                          {team.supervisorEmail && (
                            <a
                              href={`mailto:${team.supervisorEmail}`}
                              className="ml-2 text-blue-600 hover:underline text-xs"
                            >
                              {team.supervisorEmail}
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> Missing
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Submitted teams (collapsible) */}
        {submittedTeams.length > 0 && (
          <div className="space-y-3">
            <button
              onClick={() => setShowSubmitted(!showSubmitted)}
              className="flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Submitted ({summary.submitted})
              <span className="ml-2 text-xs text-gray-400">
                {showSubmitted ? '(click to collapse)' : '(click to expand)'}
              </span>
            </button>
            {showSubmitted && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-emerald-200 bg-emerald-50 text-left text-xs uppercase tracking-[0.15em] text-emerald-700">
                        <th className="px-4 py-2">Team</th>
                        <th className="px-4 py-2">University</th>
                        <th className="px-4 py-2">Submitted At</th>
                        <th className="px-4 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {submittedTeams.map((team) => (
                        <tr key={team.id} className="hover:bg-emerald-50/80">
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {team.name}
                            <span className="ml-2 text-xs text-gray-400">{team.displayId}</span>
                          </td>
                          <td className="px-4 py-2 text-gray-600">{team.university}</td>
                          <td className="px-4 py-2 text-gray-600 tabular-nums">
                            {team.submittedAt
                              ? new Date(team.submittedAt).toLocaleString('en-US', {
                                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                })
                              : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Full grid/table */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
            <Send className="h-4 w-4 mr-2" />
            All Teams Overview
          </h3>
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-[0.15em] text-gray-500">
                    <th className="px-4 py-2">Team</th>
                    <th className="px-4 py-2">University</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Submitted At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedTeams.map((team) => (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {team.name}
                        <span className="ml-2 text-xs text-gray-400">{team.displayId}</span>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{team.university}</td>
                      <td className="px-4 py-2">
                        {team.hasSubmitted ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Submitted
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> Missing
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600 tabular-nums">
                        {team.submittedAt
                          ? new Date(team.submittedAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
