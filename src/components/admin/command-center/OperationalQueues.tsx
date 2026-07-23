'use client'

import Link from 'next/link'
import { AlertTriangle, Send, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData } from './command-center-types'

export interface OperationalQueuesProps {
  submissionProgress: DashboardData['submissionProgress']
  meta: DashboardData['meta']
}

function QueueRow({
  icon: Icon,
  title,
  description,
  count,
  tone,
  href,
  actionLabel,
}: {
  icon: React.ElementType
  title: string
  description: string
  count: number
  tone: 'neutral' | 'info' | 'warning'
  href: string
  actionLabel: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 text-text-secondary" />
            <p className="font-medium text-foreground">{title}</p>
            <Badge variant={tone}>{count}</Badge>
          </div>
          <p className="text-sm leading-6 text-text-secondary">{description}</p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={href}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  )
}

export function OperationalQueues({
  submissionProgress,
  meta,
}: OperationalQueuesProps) {
  const pendingApprovals = meta.pendingTeamApprovals ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Zap className="h-5 w-5 text-accent" />
          Operational Queues
        </CardTitle>
        <CardDescription>Queues that still need a human decision or follow-up.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <QueueRow
          icon={Send}
          title="Pending submissions"
          description={
            submissionProgress.pending > 0
              ? `${submissionProgress.pending} teams still have not submitted this round.`
              : 'No teams are currently missing submissions.'
          }
          count={submissionProgress.pending}
          tone={submissionProgress.pending > 0 ? 'warning' : 'info'}
          href="/admin/submissions"
          actionLabel="View submissions"
        />

        <QueueRow
          icon={AlertTriangle}
          title="Team approvals"
          description={
            pendingApprovals > 0
              ? `${pendingApprovals} team approvals are waiting for review.`
              : 'No team approvals are waiting right now.'
          }
          count={pendingApprovals}
          tone={pendingApprovals > 0 ? 'warning' : 'neutral'}
          href="/admin/team-approvals"
          actionLabel="Review teams"
        />
      </CardContent>
    </Card>
  )
}
