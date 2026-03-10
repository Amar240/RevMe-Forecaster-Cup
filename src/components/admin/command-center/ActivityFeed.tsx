'use client'

import { useEffect, useState, useCallback } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Send, AlertTriangle, MessageSquare, Shield, Trophy, Clock, RefreshCw } from 'lucide-react'

interface ActivityEvent {
  id: string
  type: 'submission' | 'warning' | 'ticket' | 'audit' | 'scoring'
  message: string
  timestamp: string
}

const typeConfig = {
  submission: { icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' },
  ticket: { icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-100' },
  audit: { icon: Shield, color: 'text-gray-600', bg: 'bg-gray-100' },
  scoring: { icon: Trophy, color: 'text-purple-600', bg: 'bg-purple-100' },
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
    fetchEvents()
    const interval = setInterval(fetchEvents, 60000)
    return () => clearInterval(interval)
  }, [fetchEvents])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          Activity Feed
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={fetchEvents}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {events.map((event) => {
              const config = typeConfig[event.type]
              const Icon = config.icon
              return (
                <div key={event.id} className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors">
                  <div className={`h-8 w-8 rounded-full ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{event.message}</p>
                    <p className="text-xs text-gray-400">{timeAgo(event.timestamp)}</p>
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
