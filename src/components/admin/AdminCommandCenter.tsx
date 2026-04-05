'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'
import type { DashboardData } from './command-center/command-center-types'
import { ActionCenter } from './command-center/ActionCenter'
import { CommandCenterHero } from './command-center/CommandCenterHero'
import { CommandCenterSkeleton } from './command-center/CommandCenterSkeleton'
import { KpiRow } from './command-center/KpiRow'
import { OperationsSection } from './command-center/OperationsSection'
import { SubmissionProgress } from './command-center/SubmissionProgress'
import { buildCommandCenterDisplay } from './command-center/command-center-display'

export function AdminCommandCenter() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [secondsSince, setSecondsSince] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/command-center')
      if (res.ok) {
        const result = await res.json()
        setData(result)
        setLastUpdated(new Date())
        setSecondsSince(0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch command center data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => void fetchData(), 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    if (!lastUpdated) return
    const tick = setInterval(
      () => setSecondsSince(Math.floor((Date.now() - lastUpdated.getTime()) / 1000)),
      1000
    )
    return () => clearInterval(tick)
  }, [lastUpdated])

  const handleAction = async (action: string, endpoint: string) => {
    setActionLoading(action)
    try {
      const res = await csrfFetch(endpoint, { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        toast.success(result.message || 'Action completed')
        void fetchData()
      } else {
        toast.error(result.message || 'Action failed')
      }
    } catch (error) {
      clientLogger.error('Action failed:', error)
      toast.error('Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleChecklistUpdate = async (
    field: 'leaderboardReviewed' | 'participantsNotified',
    value: boolean
  ) => {
    if (!data?.currentRound) return

    setData((prev) =>
      prev
        ? {
            ...prev,
            currentRound: prev.currentRound
              ? { ...prev.currentRound, [field]: value }
              : null,
          }
        : prev
    )

    try {
      const res = await csrfFetch(`/api/admin/rounds/${data.currentRound.id}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value }),
      })

      if (!res.ok) {
        toast.error('Failed to save checklist item')
        void fetchData()
      }
    } catch {
      toast.error('Failed to save checklist item')
      void fetchData()
    }
  }

  const display = useMemo(() => {
    if (!data) return null
    const displayNow = lastUpdated
      ? new Date(lastUpdated.getTime() + secondsSince * 1000)
      : new Date()
    return buildCommandCenterDisplay(data, displayNow)
  }, [data, lastUpdated, secondsSince])

  if (loading) return <CommandCenterSkeleton />

  if (!data || !display) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Failed to load admin dashboard data</p>
        <Button onClick={fetchData} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text-secondary">
            <span>Admin Command Center</span>
            <span className="text-text-muted">/</span>
            <span>{display.seasonLabel}</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Live competition operations
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              One place to monitor the round, respond to risk, and keep the season moving.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated ? (
            <span className="text-xs font-medium text-text-muted">
              Refreshed {secondsSince}s ago
            </span>
          ) : null}
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <CommandCenterHero
        display={display}
        onAction={handleAction}
        actionLoading={actionLoading}
      />

      <KpiRow display={display} />

      <ActionCenter
        display={display}
        onAction={handleAction}
        actionLoading={actionLoading}
        onChecklistUpdate={handleChecklistUpdate}
      />

      <SubmissionProgress data={data} display={display} />

      <OperationsSection
        submissionProgress={data.submissionProgress}
        meta={data.meta}
      />
    </div>
  )
}
