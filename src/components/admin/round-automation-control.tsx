'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, CalendarClock, Hand, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  getRoundAutomationStatus,
  updateRoundAutomationMode,
} from '@/features/season/api'
import type { RoundAutomationMode, RoundAutomationStatus } from '@/features/season/types'
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
  const [targetMode, setTargetMode] = useState<RoundAutomationMode | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await getRoundAutomationStatus(seasonId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load round automation status')
    } finally {
      setLoading(false)
    }
  }, [seasonId])

  useEffect(() => {
    void load()
  }, [load])

  const changeMode = async () => {
    if (!targetMode) return
    setLoading(true)
    try {
      const next = await updateRoundAutomationMode({ seasonId, mode: targetMode, reason })
      setStatus(next)
      await onChanged?.()
      if (targetMode === 'AUTOMATIC' && next.scheduleError) {
        toast.warning('Automatic mode is active, but future schedules need administrator attention')
      } else {
        toast.success(
          targetMode === 'AUTOMATIC'
            ? 'Automatic round transitions enabled and synchronized'
            : 'Manual round control enabled'
        )
      }
      setTargetMode(null)
      setReason('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change round control mode')
    } finally {
      setLoading(false)
    }
  }

  const retryScheduleSync = async () => {
    setLoading(true)
    try {
      const next = await updateRoundAutomationMode({
        seasonId,
        mode: 'AUTOMATIC',
        reason: 'Administrator requested schedule synchronization retry',
      })
      setStatus(next)
      await onChanged?.()
      if (next.scheduleError) {
        toast.error('Schedule synchronization still needs administrator attention')
      } else {
        toast.success('Future round schedules synchronized')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not synchronize round schedules')
    } finally {
      setLoading(false)
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
                Round control
              </CardTitle>
              <CardDescription>
                Choose scheduled operation for normal competition weeks or manual control for an emergency.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
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
              <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Round control mode">
                <ModeCard
                  active={status.mode === 'AUTOMATIC'}
                  title="Automatic"
                  description="RevME opens and closes rounds at their stored times. Exact one-time AWS schedules wake the app only at a boundary."
                  icon={<Bot className="h-7 w-7" />}
                  disabled={loading || !status.infrastructure.configured}
                  onSelect={() => setTargetMode('AUTOMATIC')}
                />
                <ModeCard
                  active={status.mode === 'MANUAL'}
                  title="Manual emergency control"
                  description="Admins operate rounds directly. Existing scheduled events are safely ignored until automatic mode is restored."
                  icon={<Hand className="h-7 w-7" />}
                  disabled={loading}
                  onSelect={() => setTargetMode('MANUAL')}
                />
              </div>

              {!status.infrastructure.configured && (
                <AlertBanner variant="warning" title="Automatic scheduling is not connected">
                  Configure {status.infrastructure.missing.join(' and ')} in the deployment. Manual control remains available.
                </AlertBanner>
              )}
              {status.scheduleError && (
                <AlertBanner variant="error" title="The last schedule synchronization failed">
                  <div className="space-y-3">
                    <p>{status.scheduleError}</p>
                    {status.mode === 'AUTOMATIC' && status.infrastructure.configured && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => void retryScheduleSync()}
                      >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Retry schedule sync
                      </Button>
                    )}
                  </div>
                </AlertBanner>
              )}

              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <StatusItem
                  label="Engine"
                  value={status.infrastructure.configured ? 'Connected' : 'Not configured'}
                />
                <StatusItem
                  label="Next boundary"
                  value={status.nextTransition
                    ? `Round ${status.nextTransition.roundNumber} ${status.nextTransition.type.toLowerCase()} · ${new Date(status.nextTransition.at).toLocaleString()}`
                    : 'No future boundary'}
                />
                <StatusItem
                  label="Last decision"
                  value={status.latestRun
                    ? `${status.latestRun.outcome.replace('_', ' ').toLowerCase()} · ${new Date(status.latestRun.processedAt).toLocaleString()}`
                    : 'No transition recorded'}
                />
              </div>

              <p className="flex items-start gap-2 text-sm text-text-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                Submission deadlines are still enforced by the server even if a scheduled wake-up is delayed.
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={targetMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTargetMode(null)
            setReason('')
          }
        }}
        title={targetMode === 'AUTOMATIC' ? 'Resume automatic round control?' : 'Switch to manual control?'}
        description={targetMode === 'AUTOMATIC'
          ? 'RevME will immediately reconcile the current time, then recreate all future one-time schedules.'
          : 'Future scheduled events will be ignored. An administrator must operate rounds until automatic mode is restored.'}
        confirmLabel={targetMode === 'AUTOMATIC' ? 'Enable automatic mode' : 'Enable manual mode'}
        loading={loading}
        confirmDisabled={reason.trim().length < 5 || status?.mode === targetMode}
        onConfirm={() => void changeMode()}
      >
        <div className="space-y-2">
          <Label htmlFor="round-mode-reason">Reason</Label>
          <Input
            id="round-mode-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            placeholder="Why is this mode change needed?"
          />
        </div>
      </ConfirmDialog>
    </>
  )
}

function ModeCard({
  active,
  title,
  description,
  icon,
  disabled,
  onSelect,
}: {
  active: boolean
  title: string
  description: string
  icon: React.ReactNode
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled || active}
      onClick={onSelect}
      className={cn(
        'group min-h-44 rounded-xl border p-5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-primary bg-primary-soft shadow-sm'
          : 'border-border bg-surface hover:border-primary/40 hover:bg-surface-secondary',
        disabled && !active && 'cursor-not-allowed opacity-55'
      )}
    >
      <div className="flex items-start gap-4">
        <span className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-full border',
          active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface-secondary text-text-secondary'
        )}>
          {icon}
        </span>
        <span className="space-y-2">
          <span className="flex items-center gap-2 text-lg font-semibold text-foreground">
            {title}
            {active && <Badge variant="success">Active</Badge>}
          </span>
          <span className="block text-sm leading-6 text-text-secondary">{description}</span>
        </span>
      </div>
    </button>
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
