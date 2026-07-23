'use client'

import { useEffect, useState } from 'react'

export function formatDeadline(date: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
    timeZoneName: 'short',
  }).formatToParts(new Date(date))
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''

  return `${value('weekday')}, ${value('month')} ${value('day')}, ${value('hour')}:${value('minute')} ${value('dayPeriod')} ${value('timeZoneName')}`
}

export function DualTimezoneDeadline({ date, className }: { date: string; className?: string }) {
  const eastern = formatDeadline(date, 'America/New_York')
  const [local, setLocal] = useState<string | null>(null)
  useEffect(() => setLocal(formatDeadline(date)), [date])
  return <span className={className}><span className="tabular-nums">{eastern}</span>{local && local !== eastern && <span className="block text-xs opacity-80">Your time: <span className="tabular-nums">{local}</span></span>}</span>
}
