'use client'

import { csrfFetch } from '@/lib/csrf'

import { useState, useEffect } from 'react'
import { Bell, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { clientLogger } from '@/lib/client-logger'
import { toast } from 'sonner'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link?: string
  read: boolean
  createdAt: string
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await csrfFetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch notifications', {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error('Failed to load notifications')
    }
  }

  const markAllRead = async () => {
    setLoading(true)
    try {
      await csrfFetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      })
      fetchNotifications()
    } catch (error) {
      clientLogger.error('Failed to mark notifications read', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }

  const markRead = async (id: string) => {
    try {
      await csrfFetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      })
      fetchNotifications()
    } catch (error) {
      clientLogger.error('Failed to mark notification read', {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error('Failed to update notification')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-md p-2 text-text-secondary transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-card shadow-popover">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-semibold text-foreground">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllRead}
                    disabled={loading}
                    className="h-7 text-xs"
                  >
                    Mark all read
                  </Button>
                )}
                <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-text-secondary">
                  <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`border-b border-border p-3 last:border-b-0 hover:bg-muted ${
                      !notif.read ? 'bg-secondary' : ''
                    }`}
                    onClick={() => !notif.read && markRead(notif.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${!notif.read ? 'text-foreground' : 'text-text-secondary'}`}>
                          {notif.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {notif.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(notif.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {notif.link && (
                        <Link
                          href={notif.link}
                          onClick={() => setOpen(false)}
                          className="text-primary transition-colors hover:text-primary-hover"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
