'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardData } from './command-center-types'

export interface CompetitionHealthScoreProps {
  stats: DashboardData['stats']
  submissionProgress: DashboardData['submissionProgress']
  meta: DashboardData['meta']
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function CompetitionHealthScore({
  stats,
  submissionProgress,
}: CompetitionHealthScoreProps) {
  const participationRate =
    submissionProgress.total > 0
      ? submissionProgress.submitted / submissionProgress.total
      : 1
  const warningRate = clamp(
    1 - stats.totalWarnings / (stats.activeTeams * 3 || 1),
    0,
    1,
  )
  const activeTeamRate =
    stats.totalTeams > 0 ? stats.activeTeams / stats.totalTeams : 1

  const healthScore = Math.round(
    ((participationRate + warningRate + activeTeamRate) / 3) * 100,
  )

  const tone =
    healthScore > 85
      ? {
          ring: 'stroke-success',
          text: 'text-success',
          surface: 'bg-success-background',
          badge: 'success' as const,
        }
      : healthScore >= 70
        ? {
            ring: 'stroke-warning',
            text: 'text-warning',
            surface: 'bg-warning-background',
            badge: 'warning' as const,
          }
        : {
            ring: 'stroke-error',
            text: 'text-error',
            surface: 'bg-error-background',
            badge: 'error' as const,
          }

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (healthScore / 100) * circumference

  const subScores = [
    { label: 'Participation', value: Math.round(participationRate * 100) },
    { label: 'Warning-free', value: Math.round(warningRate * 100) },
    { label: 'Active teams', value: Math.round(activeTeamRate * 100) },
  ]

  return (
    <Card>
      <CardContent className="flex flex-col items-center px-4 py-6">
        <div className="flex w-full items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-text-muted">
              Competition Health
            </div>
            <div className="mt-1 text-sm text-text-secondary">
              Composite of participation, warnings, and active team rate
            </div>
          </div>
          <Badge variant={tone.badge}>{healthScore}%</Badge>
        </div>

        <div className="relative mt-5 h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-border"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={tone.ring}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${tone.text}`}>
              {healthScore}%
            </span>
          </div>
        </div>

        <div className={`mt-5 w-full rounded-xl border border-border p-4 ${tone.surface}`}>
          <div className="space-y-3">
            {subScores.map((score) => {
              const barTone =
                score.value >= 80 ? 'bg-success' : score.value >= 60 ? 'bg-warning' : 'bg-error'
              return (
                <div key={score.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">{score.label}</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {score.value}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div className={`h-full ${barTone}`} style={{ width: `${score.value}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
