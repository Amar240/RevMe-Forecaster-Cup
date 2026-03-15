'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Circle, PartyPopper } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData, RoundEntry } from './command-center-types'

export interface WeeklyChecklistProps {
  currentRound: DashboardData['currentRound']
  submissionProgress: DashboardData['submissionProgress']
  currentRoundEntry: RoundEntry | null
  meta: DashboardData['meta']
  stats: DashboardData['stats']
}

interface ChecklistItem {
  key: string
  label: string
  status: string
  checked: boolean
  manual: boolean
}

function storageKey(roundId: string | undefined, field: string): string {
  return `checklist:${roundId ?? 'none'}:${field}`
}

export function WeeklyChecklist({
  currentRound,
  submissionProgress,
  currentRoundEntry,
}: WeeklyChecklistProps) {
  const roundId = currentRound?.id ?? currentRoundEntry?.id
  const roundNumber = currentRound?.number ?? currentRoundEntry?.number ?? '?'

  const [leaderboardReviewed, setLeaderboardReviewed] = useState(false)
  const [participantsNotified, setParticipantsNotified] = useState(false)

  useEffect(() => {
    setLeaderboardReviewed(localStorage.getItem(storageKey(roundId, 'leaderboardReviewed')) === 'true')
    setParticipantsNotified(localStorage.getItem(storageKey(roundId, 'participantsNotified')) === 'true')
  }, [roundId])

  const toggleManual = useCallback(
    (field: 'leaderboardReviewed' | 'participantsNotified') => {
      const key = storageKey(roundId, field)

      if (field === 'leaderboardReviewed') {
        const next = !leaderboardReviewed
        setLeaderboardReviewed(next)
        localStorage.setItem(key, String(next))
      } else {
        const next = !participantsNotified
        setParticipantsNotified(next)
        localStorage.setItem(key, String(next))
      }
    },
    [roundId, leaderboardReviewed, participantsNotified]
  )

  const roundOpen = !!currentRound && (currentRound.status === 'Open' || currentRound.status === 'Closing Soon')
  const submissionRate = submissionProgress.total > 0 ? submissionProgress.submitted / submissionProgress.total : 0
  const submissionsMonitored = submissionRate >= 0.8
  const roundClosed = currentRound?.status === 'Closed' || (!currentRound && currentRoundEntry !== null)
  const actualsUploaded = currentRoundEntry?.hasActuals === true
  const scoringCompleted = currentRoundEntry?.isScored === true

  const items: ChecklistItem[] = [
    {
      key: 'roundOpen',
      label: `Round ${roundNumber} is open`,
      status: roundOpen ? currentRound!.status : 'Not open',
      checked: roundOpen,
      manual: false,
    },
    {
      key: 'submissionsMonitored',
      label: 'Submissions monitored',
      status: `${submissionProgress.submitted}/${submissionProgress.total} teams submitted`,
      checked: submissionsMonitored,
      manual: false,
    },
    {
      key: 'roundClosed',
      label: `Round ${roundNumber} closed`,
      status: roundClosed ? 'Closed' : 'Still open',
      checked: roundClosed,
      manual: false,
    },
    {
      key: 'actualsUploaded',
      label: 'Actuals uploaded',
      status: actualsUploaded ? 'Uploaded' : 'Pending',
      checked: actualsUploaded,
      manual: false,
    },
    {
      key: 'scoringCompleted',
      label: 'Scoring completed',
      status: scoringCompleted ? 'Scored' : 'Not yet',
      checked: scoringCompleted,
      manual: false,
    },
    {
      key: 'leaderboardReviewed',
      label: 'Leaderboard reviewed',
      status: leaderboardReviewed ? 'Reviewed' : 'Needs review',
      checked: leaderboardReviewed,
      manual: true,
    },
    {
      key: 'participantsNotified',
      label: 'Participants notified',
      status: participantsNotified ? 'Notified' : 'Pending',
      checked: participantsNotified,
      manual: true,
    },
  ]

  const completedCount = items.filter((item) => item.checked).length
  const allComplete = completedCount === items.length
  const progressPercent = Math.round((completedCount / items.length) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-xl font-semibold">
          <span>Weekly Checklist - Round {roundNumber}</span>
          <span className="text-sm font-medium text-text-secondary">
            {completedCount}/{items.length} complete
          </span>
        </CardTitle>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-secondary">
          <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
              item.manual ? 'cursor-pointer hover:bg-surface-secondary' : ''
            }`}
            onClick={item.manual ? () => toggleManual(item.key as 'leaderboardReviewed' | 'participantsNotified') : undefined}
            role={item.manual ? 'button' : undefined}
            tabIndex={item.manual ? 0 : undefined}
            onKeyDown={
              item.manual
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleManual(item.key as 'leaderboardReviewed' | 'participantsNotified')
                    }
                  }
                : undefined
            }
          >
            {item.checked ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            ) : (
              <Circle className={`h-5 w-5 shrink-0 ${item.manual ? 'text-text-muted hover:text-text-secondary' : 'text-border-strong'}`} />
            )}
            <span className={`text-sm font-medium ${item.checked ? 'text-foreground' : 'text-text-secondary'}`}>{item.label}</span>
            <span className="ml-auto text-xs text-text-muted">{item.status}</span>
          </div>
        ))}

        {allComplete && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-background px-4 py-3 text-sm font-medium text-success">
            <PartyPopper className="h-5 w-5" />
            All steps complete for Round {roundNumber}!
          </div>
        )}
      </CardContent>
    </Card>
  )
}
