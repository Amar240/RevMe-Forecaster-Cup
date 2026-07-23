import Link from 'next/link'
import { ArrowRight, Clock3, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CommandCenterDisplay, DisplayAction } from './command-center-display'

interface CommandCenterHeroProps {
  display: CommandCenterDisplay
  onAction: (action: string, endpoint: string) => void
  actionLoading: string | null
}

function ActionButton({
  action,
  onAction,
  actionLoading,
  secondary = false,
}: {
  action: DisplayAction
  onAction: (action: string, endpoint: string) => void
  actionLoading: string | null
  secondary?: boolean
}) {
  if (action.kind === 'href') {
    return (
      <Button asChild variant={secondary ? 'outline' : 'default'}>
        <Link href={action.href!}>
          {action.title}
          {!secondary && <ArrowRight className="ml-2 h-4 w-4" />}
        </Link>
      </Button>
    )
  }

  return (
    <Button
      variant={secondary ? 'outline' : 'default'}
      onClick={() => onAction(action.actionKey || action.id, action.endpoint!)}
      disabled={actionLoading === (action.actionKey || action.id)}
    >
      {actionLoading === (action.actionKey || action.id) ? (
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
      ) : null}
      {action.title}
      {!secondary && <ArrowRight className="ml-2 h-4 w-4" />}
    </Button>
  )
}

export function CommandCenterHero({
  display,
  onAction,
  actionLoading,
}: CommandCenterHeroProps) {
  return (
    <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary-soft via-card to-card">
      <CardContent className="p-0">
        <div className="border-b border-border/70 px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Operational season</Badge>
            {display.seasonStatusLabel ? (
              <Badge variant="outline">{display.seasonStatusLabel}</Badge>
            ) : null}
          </div>

          <div className="mt-4 grid gap-6 xl:grid-cols-[1.6fr_1fr] xl:items-start">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-text-secondary">{display.seasonLabel}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                    {display.roundLabel}
                  </h2>
                  <Badge variant={display.roundBadge.tone}>{display.roundBadge.label}</Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-card/80 px-4 py-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    <Clock3 className="h-4 w-4" />
                    Primary Deadline
                  </div>
                  <div className="mt-2 text-base font-semibold text-foreground">
                    {display.deadlineLabel}
                  </div>
                  {display.countdownLabel ? (
                    <p className="mt-1 text-sm text-text-secondary">{display.countdownLabel}</p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border bg-card/80 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Submission Progress
                  </div>
                  <div className="mt-2 text-base font-semibold text-foreground">
                    {display.submissionSummary}
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${display.submissionPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                <ShieldAlert className="h-4 w-4" />
                Primary Risk
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    display.primaryRiskTone === 'success'
                      ? 'bg-success'
                      : display.primaryRiskTone === 'warning'
                        ? 'bg-warning'
                        : display.primaryRiskTone === 'error'
                          ? 'bg-error'
                          : display.primaryRiskTone === 'neutral'
                            ? 'bg-muted'
                            : 'bg-info'
                  }`}
                />
                <p className="text-sm leading-6 text-foreground">{display.primaryRiskText}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <ActionButton
                  action={display.primaryAction}
                  onAction={onAction}
                  actionLoading={actionLoading}
                />
                {display.secondaryAction ? (
                  <ActionButton
                    action={display.secondaryAction}
                    onAction={onAction}
                    actionLoading={actionLoading}
                    secondary
                  />
                ) : null}
              </div>

              <div className="mt-5 rounded-xl border border-border/80 bg-surface-secondary px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Scoring Status
                </div>
                <p className="mt-1 text-sm font-medium text-foreground">{display.scoringStatus}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
