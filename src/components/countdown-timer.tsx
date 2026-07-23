'use client'

import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  closesAt: string | Date
  className?: string
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-2 shadow-sm min-w-[52px]">
        <span className="text-2xl font-bold tabular-nums text-primary-foreground">
          {value.toString().padStart(2, '0')}
        </span>
      </div>
      <span className="mt-1 text-xs font-medium uppercase tracking-wider text-primary-foreground/80">
        {label}
      </span>
    </div>
  )
}

export function CountdownTimer({ closesAt, className = '' }: CountdownTimerProps) {
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const calculateTimeLeft = () => {
      const deadline = new Date(closesAt)
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setIsExpired(true)
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [closesAt])

  if (!mounted) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="min-w-[52px] rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-2 animate-pulse">
          <span className="text-2xl font-bold tabular-nums text-primary-foreground">--</span>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className="text-error font-bold text-lg animate-pulse">Round Closed</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {timeLeft.days > 0 && <TimeBlock value={timeLeft.days} label="days" />}
      <TimeBlock value={timeLeft.hours} label="hours" />
      <TimeBlock value={timeLeft.minutes} label="min" />
      <TimeBlock value={timeLeft.seconds} label="sec" />
    </div>
  )
}

export function CountdownTimerCompact({ closesAt, className = '' }: CountdownTimerProps) {
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [isExpired, setIsExpired] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    const calculateTimeLeft = () => {
      const deadline = new Date(closesAt)
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setIsExpired(true)
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [closesAt])

  if (!mounted) {
    return <span className={`font-mono font-semibold tabular-nums ${className}`}>--</span>
  }

  if (isExpired) {
    return <span className={`text-error font-semibold ${className}`}>Closed</span>
  }

  const parts = []
  if (timeLeft.days > 0) parts.push(`${timeLeft.days}d`)
  parts.push(`${timeLeft.hours}h`)
  parts.push(`${timeLeft.minutes}m`)
  parts.push(`${timeLeft.seconds}s`)

  return (
    <span className={`font-mono font-semibold tabular-nums ${className}`}>
      {parts.join(' ')}
    </span>
  )
}
