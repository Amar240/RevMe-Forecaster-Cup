'use client'

import { useEffect, useState } from 'react'

function format(date: string, timeZone?: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(date))
}

export function DualTimezoneDeadline({ date, className }: { date: string; className?: string }) {
  const eastern = format(date, 'America/New_York')
  const [local, setLocal] = useState<string | null>(null)
  useEffect(() => setLocal(format(date)), [date])
  return <span className={className}><span className="tabular-nums">{eastern}</span>{local && local !== eastern && <span className="block text-xs opacity-80">Your time: <span className="tabular-nums">{local}</span></span>}</span>
}
