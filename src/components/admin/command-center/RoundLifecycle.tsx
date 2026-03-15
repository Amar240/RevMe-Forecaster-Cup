import { CheckCircle, Clock, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from './StatusBadge'
import type { RoundEntry } from './command-center-types'

export interface RoundLifecycleProps {
  rounds: RoundEntry[]
  onAction: (action: string, endpoint: string) => void
  actionLoading: string | null
}

function getRoundSurface(status: string) {
  if (status === 'Open') return 'border-success/20 bg-success-background/60'
  if (status === 'Closing Soon') return 'border-warning/20 bg-warning-background/60'
  return 'border-border bg-surface-secondary'
}

function getRoundMarker(status: string) {
  if (status === 'Open') return 'bg-success-background text-success'
  if (status === 'Closing Soon') return 'bg-warning-background text-warning'
  return 'bg-muted text-text-secondary'
}

export function RoundLifecycle({ rounds }: RoundLifecycleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Clock className="h-5 w-5 text-primary" />
          All Rounds
        </CardTitle>
        <CardDescription>Season round status and progress.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rounds.map((round) => (
            <div
              key={round.id}
              className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${getRoundSurface(round.status)}`}
            >
              <div className="flex items-center gap-4">
                <div className={`rounded-lg px-3 py-2 ${getRoundMarker(round.status)}`}>
                  <span className="text-lg font-bold">{round.number}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Round {round.number}</p>
                  <p className="text-sm text-text-secondary">
                    {new Date(round.opensAt).toLocaleDateString()} -{' '}
                    {new Date(round.closesAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {round.submissionCount} submissions
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    {round.hasActuals && (
                      <span className="flex items-center text-success">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Actuals
                      </span>
                    )}
                    {round.isScored && (
                      <span className="flex items-center text-primary">
                        <Trophy className="mr-1 h-3 w-3" />
                        Scored
                      </span>
                    )}
                    {!round.hasActuals && !round.isScored && (
                      <Badge variant="secondary">In progress</Badge>
                    )}
                  </div>
                </div>
                <StatusBadge status={round.status} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
