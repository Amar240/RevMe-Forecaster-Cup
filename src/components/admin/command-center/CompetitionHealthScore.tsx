'use client'

import { useState } from 'react'
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
  const [expanded, setExpanded] = useState(false)

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

  const color =
    healthScore > 85
      ? { ring: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' }
      : healthScore >= 70
        ? { ring: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' }
        : { ring: 'stroke-red-500', text: 'text-red-600', bg: 'bg-red-50' }

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (healthScore / 100) * circumference

  const subScores = [
    { label: 'Participation', value: Math.round(participationRate * 100) },
    { label: 'Warning-free', value: Math.round(warningRate * 100) },
    { label: 'Active teams', value: Math.round(activeTeamRate * 100) },
  ]

  return (
    <Card
      className="border-gray-200 cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => setExpanded((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setExpanded((v) => !v)
        }
      }}
    >
      <CardContent className="flex flex-col items-center py-6 px-4">
        <div className="relative h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-200"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={color.ring}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-3xl font-bold tabular-nums ${color.text}`}>
              {healthScore}%
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium text-gray-500">Competition Health</p>

        {expanded && (
          <div className="mt-4 w-full space-y-2">
            {subScores.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{s.label}</span>
                <span className="font-semibold text-gray-900 tabular-nums">{s.value}%</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
