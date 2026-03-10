import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, Clock, Trophy } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import type { RoundEntry } from './command-center-types'

export interface RoundLifecycleProps {
  rounds: RoundEntry[]
  onAction: (action: string, endpoint: string) => void
  actionLoading: string | null
}

export function RoundLifecycle({ rounds }: RoundLifecycleProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-semibold">
          <Clock className="h-5 w-5 mr-2 text-blue-500" />
          All Rounds
        </CardTitle>
        <CardDescription>Season round status and progress</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {rounds.map((round) => (
            <div
              key={round.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                round.status === 'Open'
                  ? 'bg-green-50 border-green-200'
                  : round.status === 'Closing Soon'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`p-2 rounded-lg ${
                    round.status === 'Open'
                      ? 'bg-green-100'
                      : round.status === 'Closing Soon'
                        ? 'bg-amber-100'
                        : 'bg-gray-100'
                  }`}
                >
                  <span className="font-bold text-lg">{round.number}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Round {round.number}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(round.opensAt).toLocaleDateString()} -{' '}
                    {new Date(round.closesAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {round.submissionCount} submissions
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    {round.hasActuals && (
                      <span className="flex items-center text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Actuals
                      </span>
                    )}
                    {round.isScored && (
                      <span className="flex items-center text-blue-600">
                        <Trophy className="h-3 w-3 mr-1" />
                        Scored
                      </span>
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
