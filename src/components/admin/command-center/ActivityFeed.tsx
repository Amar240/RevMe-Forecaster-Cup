'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Clock,
  MessageSquare,
  RefreshCw,
  Send,
  Shield,
  Trophy,
} from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface ActivityEvent {
  id: string
  type: 'submission' | 'warning' | 'ticket' | 'audit' | 'scoring'
  message: string
  timestamp: string
}

const typeConfig = {
  submission: { icon: Send, iconClass: 'text-success', bgClass: 'bg-success-background' },
  warning: { icon: AlertTriangle, iconClass: 'text-warning', bgClass: 'bg-warning-background' },
  ticket: { icon: MessageSquare, iconClass: 'text-info', bgClass: 'bg-info-background' },
  audit: { icon: Shield, iconClass: 'text-text-secondary', bgClass: 'bg-muted' },
  scoring: { icon: Trophy, iconClass: 'text-accent', bgClass: 'bg-accent-soft' },
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/activity-feed')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      clientLogger.error('Failed to fetch activity feed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEvents()
    const interval = setInterval(fetchEvents, 60000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="h-5 w-5 text-text-secondary" />
          Activity Feed
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchEvents}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">No recent activity</p>
        ) : (
          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {events.map((event) => {
              const config = typeConfig[event.type]
              const Icon = config.icon

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-secondary"
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${config.bgClass}`}
                  >
                    <Icon className={`h-4 w-4 ${config.iconClass}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{event.message}</p>
                    <p className="text-xs text-text-muted">{timeAgo(event.timestamp)}</p>
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
