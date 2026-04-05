import {
  AlertTriangle,
  CheckCircle2,
  Send,
  ShieldCheck,
  Trophy,
  Upload,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { QuickActionCard } from './QuickActionCard'
import type { CommandCenterDisplay, DisplayAction, DisplayHealthRow } from './command-center-display'

interface ActionCenterProps {
  display: CommandCenterDisplay
  onAction: (action: string, endpoint: string) => void
  actionLoading: string | null
  onChecklistUpdate: (
    field: 'leaderboardReviewed' | 'participantsNotified',
    value: boolean
  ) => void
}

const ACTION_VARIANTS: Record<
  DisplayAction['tone'],
  'default' | 'primary' | 'warning' | 'success'
> = {
  neutral: 'default',
  info: 'primary',
  success: 'success',
  warning: 'warning',
  error: 'warning',
}

const ACTION_ICONS = {
  send: Send,
  submissions: Send,
  actuals: Upload,
  scoring: Trophy,
  leaderboard: Trophy,
  approvals: ShieldCheck,
  risk: AlertTriangle,
} as const

function HealthRow({
  row,
  onChecklistUpdate,
}: {
  row: DisplayHealthRow
  onChecklistUpdate: (
    field: 'leaderboardReviewed' | 'participantsNotified',
    value: boolean
  ) => void
}) {
  const toneIcon =
    row.tone === 'success'
      ? CheckCircle2
      : row.tone === 'warning'
        ? AlertTriangle
        : row.tone === 'error'
          ? AlertTriangle
          : ShieldCheck
  const ToneIcon = toneIcon
  const badgeLabel =
    row.tone === 'success'
      ? 'On track'
      : row.tone === 'neutral'
        ? 'Monitoring'
        : row.tone === 'info'
          ? 'Needs attention'
          : row.tone === 'error'
            ? 'Urgent'
            : 'Needs action'

  return (
    <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ToneIcon className="h-4 w-4 text-text-secondary" />
            <p className="font-medium text-foreground">{row.label}</p>
            <Badge variant={row.tone}>{badgeLabel}</Badge>
          </div>
          <p className="text-sm leading-6 text-text-secondary">{row.description}</p>
        </div>

        {row.kind === 'link' && row.href ? (
          <Button asChild size="sm" variant="outline">
            <a href={row.href}>{row.actionLabel ?? 'Open'}</a>
          </Button>
        ) : null}

        {row.kind === 'toggle' && row.field ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChecklistUpdate(row.field!, !row.checked)}
          >
            {row.actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function ActionCenter({
  display,
  onAction,
  actionLoading,
  onChecklistUpdate,
}: ActionCenterProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Primary Actions</CardTitle>
          <CardDescription>Deliberate next steps for the current competition state.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {display.actions.map((action) => {
            const Icon = ACTION_ICONS[action.icon]
            return (
              <QuickActionCard
                key={action.id}
                icon={Icon}
                title={action.title}
                description={action.description}
                variant={ACTION_VARIANTS[action.tone]}
                loading={action.kind === 'endpoint' ? actionLoading === (action.actionKey || action.id) : false}
                href={action.kind === 'href' ? action.href : undefined}
                onClick={
                  action.kind === 'endpoint'
                    ? () => onAction(action.actionKey || action.id, action.endpoint!)
                    : undefined
                }
              />
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competition Health</CardTitle>
          <CardDescription>Status-first signals that point to operational follow-up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {display.healthRows.map((row) => (
            <HealthRow
              key={row.id}
              row={row}
              onChecklistUpdate={onChecklistUpdate}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
