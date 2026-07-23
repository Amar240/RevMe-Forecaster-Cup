import { CalendarRange, CheckCircle2, Clock3, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { RoundEntry } from './command-center-types'

export interface RoundLifecycleProps {
  rounds: RoundEntry[]
}

function formatShortRange(opensAt: string, closesAt: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  })

  return `${formatter.format(new Date(opensAt))} - ${formatter.format(new Date(closesAt))}`
}

function getRoundDetail(round: RoundEntry) {
  if (round.isScored) {
    return {
      label: 'Scoring complete',
      tone: 'success' as const,
      icon: Trophy,
    }
  }

  if (round.hasActuals) {
    return {
      label: 'Actuals uploaded',
      tone: 'info' as const,
      icon: CheckCircle2,
    }
  }

  if (round.status === 'Open' || round.status === 'Closing Soon') {
    return {
      label: 'Collecting submissions',
      tone: round.status === 'Closing Soon' ? ('warning' as const) : ('info' as const),
      icon: Clock3,
    }
  }

  if (round.status === 'Closed') {
    return {
      label: 'Awaiting actuals',
      tone: 'warning' as const,
      icon: Clock3,
    }
  }

  return {
    label: 'Upcoming',
    tone: 'neutral' as const,
    icon: CalendarRange,
  }
}

function getRoundSurface(status: string) {
  if (status === 'Open') return 'border-success/20 bg-success-background/60'
  if (status === 'Closing Soon') return 'border-warning/20 bg-warning-background/60'
  if (status === 'Upcoming') return 'border-border bg-card'
  return 'border-border bg-surface-secondary'
}

export function RoundLifecycle({ rounds }: RoundLifecycleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <CalendarRange className="h-5 w-5 text-primary" />
          Round Timeline
        </CardTitle>
        <CardDescription>Season cadence and scoring readiness by round.</CardDescription>
      </CardHeader>
      <CardContent>
        {rounds.length === 0 ? (
          <p className="text-sm text-text-secondary">No rounds are configured for the current operational season.</p>
        ) : (
          <div className="space-y-3">
            {rounds.map((round) => {
              const detail = getRoundDetail(round)
              const DetailIcon = detail.icon

              return (
                <div
                  key={round.id}
                  className={`rounded-xl border p-4 transition-colors ${getRoundSurface(round.status)}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">Round {round.number}</p>
                        <Badge variant={round.status === 'Open' ? 'success' : round.status === 'Closing Soon' ? 'warning' : round.status === 'Upcoming' ? 'info' : 'neutral'}>
                          {round.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-text-secondary">
                        {formatShortRange(round.opensAt, round.closesAt)} ET
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 text-sm text-text-secondary lg:items-end">
                      <div className="flex items-center gap-2">
                        <DetailIcon className="h-4 w-4" />
                        <span>{detail.label}</span>
                      </div>
                      <p>
                        {round.submissionCount} submissions recorded
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
