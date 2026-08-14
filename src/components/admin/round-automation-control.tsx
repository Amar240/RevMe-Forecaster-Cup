'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  ChevronDown,
  Hand,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getRoundAutomationResumePreview,
  getRoundAutomationStatus,
  resumeRoundAutomation,
  startRoundAutomationEmergency,
} from '@/features/season/api'
import type { RoundAutomationResumePreview, RoundAutomationStatus } from '@/features/season/types'
import { cn } from '@/lib/utils'

export function RoundAutomationControl({
  seasonId,
  onChanged,
}: {
  seasonId: string
  onChanged?: () => void | Promise<void>
}) {
  const [status, setStatus] = useState<RoundAutomationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [emergencyReason, setEmergencyReason] = useState('')
  const [expectedEndAt, setExpectedEndAt] = useState(() => toLocalDateTimeInput(addMinutes(new Date(), 60)))
  const [acknowledged, setAcknowledged] = useState(false)
  const [resumePreview, setResumePreview] = useState<RoundAutomationResumePreview | null>(null)
  const [resumeReason, setResumeReason] = useState('Emergency control reviewed; automatic scheduling can resume.')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await getRoundAutomationStatus(seasonId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load round scheduling status')
    } finally {
      setLoading(false)
    }
  }, [seasonId])

  useEffect(() => {
    void load()
  }, [load])

  const emergencyActive = Boolean(status?.activeOverride)
  const emergencyCopy = emergencyActive ? 'Extend emergency control' : 'Start emergency control'
  const canSubmitEmergency =
    emergencyReason.trim().length >= 10
    && Boolean(expectedEndAt)
    && acknowledged
    && !actionLoading

  const healthBadge = useMemo(() => {
    if (!status) return null
    if (status.health === 'RUNNING') return <Badge variant="success">Running</Badge>
    if (status.health === 'ATTENTION_NEEDED') return <Badge variant="warning">Attention needed</Badge>
    return <Badge variant="warning">Setup required</Badge>
  }, [status])

  // Translate infrastructure-not-configured failures (e.g. the scheduler service isn't set up in this
  // environment) into a calm, non-technical message instead of a raw error string.
  const friendlyError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : ''
    if (/not configured|scheduler|lambda|eventbridge|arn/i.test(message)) {
      return 'Automatic scheduling isn’t connected in this environment yet. Round deadlines are still enforced.'
    }
    return message || fallback
  }

  const startOrExtendEmergency = async () => {
    setActionLoading(true)
    try {
      const next = await startRoundAutomationEmergency({
        seasonId,
        reason: emergencyReason,
        expectedEndAt: new Date(expectedEndAt).toISOString(),
        acknowledgeConsequences: true,
      })
      setStatus(next)
      setEmergencyReason('')
      setExpectedEndAt(toLocalDateTimeInput(addMinutes(new Date(), 60)))
      setAcknowledged(false)
      await onChanged?.()
      toast.success(emergencyActive ? 'Emergency review time updated' : 'Emergency round control started')
    } catch (error) {
      toast.error(friendlyError(error, 'Could not start emergency round control'))
    } finally {
      setActionLoading(false)
    }
  }

  const openResumePreview = async () => {
    setActionLoading(true)
    try {
      const data = await getRoundAutomationResumePreview(seasonId)
      setResumePreview(data.preview)
    } catch (error) {
      toast.error(friendlyError(error, 'Could not prepare the resume review'))
    } finally {
      setActionLoading(false)
    }
  }

  const confirmResume = async () => {
    if (!resumePreview) return
    setActionLoading(true)
    try {
      const next = await resumeRoundAutomation({
        seasonId,
        fingerprint: resumePreview.fingerprint,
        reason: resumeReason,
      })
      setStatus(next)
      setResumePreview(null)
      await onChanged?.()
      toast.success('Automatic round scheduling resumed')
    } catch (error) {
      toast.error(friendlyError(error, 'Could not resume automatic scheduling'))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 font-display">
                <CalendarClock className="h-5 w-5 text-primary" />
                Round scheduling
              </CardTitle>
              <CardDescription>
                RevME handles round changes automatically. Use emergency controls only when an administrator needs to take over.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading || actionLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading && !status ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : status ? (
            <>
              <div className="rounded-2xl border border-primary/40 bg-primary-soft p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Bot className="h-7 w-7" />
                    </span>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-foreground">Automatic scheduling</h3>
                        <Badge variant="info">Recommended</Badge>
                        {healthBadge}
                      </div>
                      <p className="max-w-2xl text-sm leading-6 text-text-secondary">
                        RevME opens and closes every round at its scheduled time. Deadlines are still checked by the server.
                      </p>
                    </div>
                  </div>
                  {status.activeOverride && (
                    <Button
                      type="button"
                      onClick={() => void openResumePreview()}
                      disabled={actionLoading}
                    >
                      {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Resume automatic
                    </Button>
                  )}
                </div>
              </div>

              {status.activeOverride && (
                <AlertBanner variant="warning" title="Emergency round control is active">
                  <div className="space-y-2">
                    <p>
                      Automatic round changes are paused. Manual round actions are available until an administrator resumes automatic scheduling.
                    </p>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <CompactDetail label="Started by" value={status.activeOverride.activatedBy ?? 'Administrator'} />
                      <CompactDetail label="Review by" value={status.activeOverride.expectedEndAt ? formatEasternDateTime(status.activeOverride.expectedEndAt) : 'Review required'} />
                      <CompactDetail label="Reason" value={status.activeOverride.reason} wide />
                    </dl>
                  </div>
                </AlertBanner>
              )}

              {!status.activeOverride && status.health === 'SETUP_REQUIRED' && (
                <AlertBanner variant="warning" title="Automatic scheduling setup is incomplete">
                  Round deadlines are still enforced. Finish deployment setup before relying on automatic transitions; emergency controls remain available if an administrator needs to manage a round manually.
                </AlertBanner>
              )}

              {!status.activeOverride && status.health === 'ATTENTION_NEEDED' && (
                <AlertBanner variant="warning" title="Automatic scheduling needs attention">
                  Automatic scheduling needs an administrator review. If a round must be operated right now, start emergency control below.
                </AlertBanner>
              )}

              <StatusItem
                label="Next scheduled change"
                value={status.nextTransition
                  ? `${formatTransitionAction(status.nextTransition)} · ${formatTransitionTime(status.nextTransition)}`
                  : 'No upcoming round changes'}
              />

              <p className="flex items-start gap-2 text-sm text-text-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                Forecast submissions close at the configured deadline even if an automatic wake-up is delayed.
              </p>

              <details className="group rounded-xl border border-border bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="flex items-center gap-2">
                    <Hand className="h-4 w-4 text-warning" />
                    Emergency controls
                  </span>
                  <ChevronDown className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-4 border-t border-border px-4 py-4">
                  <AlertBanner variant="info" title="Use only when an administrator must take over round operations">
                    Emergency control pauses automatic round changes. It does not pause the season, and it does not extend student deadlines.
                  </AlertBanner>

                  <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                    <div className="space-y-2">
                      <Label htmlFor="round-emergency-reason">Reason</Label>
                      <Textarea
                        id="round-emergency-reason"
                        value={emergencyReason}
                        onChange={(event) => setEmergencyReason(event.target.value)}
                        maxLength={500}
                        placeholder="Explain why an administrator needs temporary manual round control."
                      />
                      <p className="text-xs text-text-muted">10–500 characters. This is saved in the audit log.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="round-emergency-end">Review by</Label>
                      <Input
                        id="round-emergency-end"
                        type="datetime-local"
                        value={expectedEndAt}
                        onChange={(event) => setExpectedEndAt(event.target.value)}
                      />
                      <p className="text-xs text-text-muted">Choose a time between 15 minutes and 24 hours from now.</p>
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                    />
                    <span className="text-text-secondary">
                      I understand that automatic round changes will pause, manual round buttons will become available, and another administrator may be notified.
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant={emergencyActive ? 'outline' : 'default'}
                      disabled={!canSubmitEmergency}
                      onClick={() => void startOrExtendEmergency()}
                    >
                      {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                      {emergencyCopy}
                    </Button>
                    {emergencyActive && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => void openResumePreview()}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Review and resume automatic
                      </Button>
                    )}
                  </div>
                </div>
              </details>

              <details className="group rounded-xl border border-border bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  System details
                  <ChevronDown className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180" />
                </summary>
                <dl className="grid gap-4 border-t border-border px-4 py-4 text-sm sm:grid-cols-2">
                  <TechnicalDetail
                    label="Schedule synchronization"
                    value={status.lastSyncedAt
                      ? `Last synced ${formatEasternDateTime(status.lastSyncedAt)}`
                      : 'Not synchronized yet'}
                  />
                  <TechnicalDetail
                    label="Configuration status"
                    value={status.infrastructure.configured ? 'Complete' : `Missing ${status.infrastructure.missing.length} setting${status.infrastructure.missing.length === 1 ? '' : 's'}`}
                  />
                  <TechnicalDetail
                    label="Schedule group"
                    value={status.infrastructure.groupName || 'Not configured'}
                  />
                  <TechnicalDetail
                    label="Configuration version"
                    value={String(status.generation)}
                  />
                  <TechnicalDetail
                    label="Last automation check"
                    value={status.latestRun
                      ? `${formatRunOutcome(status.latestRun.outcome)} · ${formatEasternDateTime(status.latestRun.processedAt)}`
                      : 'No automation check recorded yet'}
                  />
                  <TechnicalDetail
                    label="Last processing source"
                    value={status.latestRun ? formatRunTrigger(status.latestRun.trigger) : 'None recorded'}
                  />
                  {status.scheduleError && (
                    <TechnicalDetail label="Last setup error" value={status.scheduleError} />
                  )}
                </dl>
              </details>
            </>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resumePreview !== null}
        onOpenChange={(open) => {
          if (!open) setResumePreview(null)
        }}
        title="Resume automatic scheduling?"
        description="Review the current round state before returning control to automatic scheduling."
        confirmLabel="Resume automatic"
        loading={actionLoading}
        confirmDisabled={!resumePreview || resumeReason.trim().length < 10}
        onConfirm={() => void confirmResume()}
      >
        {resumePreview && (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <PreviewItem
                label="Current-time result"
                value={resumePreview.impliedOpenRound
                  ? `Round ${resumePreview.impliedOpenRound.number} should be open`
                  : 'No round should be open right now'}
              />
              <PreviewItem
                label="Future schedules"
                value={`${resumePreview.schedulesToReplace} upcoming schedule${resumePreview.schedulesToReplace === 1 ? '' : 's'} will be refreshed`}
              />
              <PreviewItem
                label="Rounds to open"
                value={resumePreview.roundsToOpen.length ? resumePreview.roundsToOpen.map((round) => `Round ${round.number}`).join(', ') : 'None'}
              />
              <PreviewItem
                label="Rounds to close"
                value={resumePreview.roundsToClose.length ? resumePreview.roundsToClose.map((round) => `Round ${round.number}`).join(', ') : 'None'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="round-resume-reason">Resume reason</Label>
              <Textarea
                id="round-resume-reason"
                value={resumeReason}
                onChange={(event) => setResumeReason(event.target.value)}
                maxLength={500}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function PreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  )
}

function CompactDetail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn(wide && 'sm:col-span-2')}>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 text-foreground">{value}</dd>
    </div>
  )
}

function TechnicalDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-mono text-sm text-foreground">{value}</dd>
    </div>
  )
}

function formatTransitionAction(transition: RoundAutomationStatus['nextTransition']) {
  if (!transition) return ''
  return `${transition.type === 'OPEN' ? 'Open' : 'Close'} Round ${transition.roundNumber}`
}

function formatTransitionTime(transition: NonNullable<RoundAutomationStatus['nextTransition']>) {
  const scheduledAt = new Date(transition.at)
  if (transition.type === 'CLOSE') scheduledAt.setSeconds(scheduledAt.getSeconds() + 1)
  return formatEasternDateTime(scheduledAt)
}

function formatEasternDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value))
}

function formatRunOutcome(outcome: NonNullable<RoundAutomationStatus['latestRun']>['outcome']) {
  switch (outcome) {
    case 'APPLIED':
      return 'Round status updated'
    case 'NO_CHANGE':
      return 'No action needed'
    case 'SKIPPED':
      return 'Scheduled action skipped'
    case 'FAILED':
      return 'Attention required'
  }
}

function formatRunTrigger(trigger: NonNullable<RoundAutomationStatus['latestRun']>['trigger']) {
  switch (trigger) {
    case 'SCHEDULED':
      return 'Scheduled automation'
    case 'ADMIN':
      return 'Administrator action'
    case 'MODE_CHANGE':
      return 'Scheduling mode change'
    case 'RECOVERY':
      return 'Recovery check'
  }
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000)
}

function toLocalDateTimeInput(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}
