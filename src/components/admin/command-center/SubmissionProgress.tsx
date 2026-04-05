import { Activity, Clock3, Radar, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData } from './command-center-types'
import type { CommandCenterDisplay } from './command-center-display'
import { RoundLifecycle } from './RoundLifecycle'
import { SubmissionTracker } from './SubmissionTracker'

export interface SubmissionProgressProps {
  data: DashboardData
  display: CommandCenterDisplay
}

function SummaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-foreground">{value}</div>
    </div>
  )
}

export function SubmissionProgress({ data, display }: SubmissionProgressProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle>Submission Progress</CardTitle>
          <CardDescription>
            Current-round coverage first, with the live tracker kept as secondary detail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-primary/15 bg-primary-soft/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={display.roundBadge.tone}>{display.roundBadge.label}</Badge>
                  <span className="text-sm font-medium text-text-secondary">
                    {display.roundLabel}
                  </span>
                </div>
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                  {display.submissionSummary}
                </h3>
                <p className="text-sm leading-6 text-text-secondary">
                  {display.deadlineLabel}
                  {display.countdownLabel ? ` · ${display.countdownLabel}` : ''}
                </p>
              </div>

              <div className="text-left lg:text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Current submission rate
                </div>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {display.submissionPercent}%
                </div>
              </div>
            </div>

            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${display.submissionPercent}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryStat
              icon={Activity}
              label="Submitted"
              value={`${data.submissionProgress.submitted} of ${data.submissionProgress.total}`}
            />
            <SummaryStat
              icon={Timer}
              label="Pending"
              value={`${data.submissionProgress.pending} teams`}
            />
            <SummaryStat
              icon={Clock3}
              label="Scoring Status"
              value={display.scoringStatus}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Live tracker detail</p>
            </div>
            <SubmissionTracker compact />
          </div>
        </CardContent>
      </Card>

      <RoundLifecycle rounds={data.rounds} />
    </div>
  )
}
