import { describeTrend } from '@/lib/learning-analytics'
import { cn } from '@/lib/utils'

export function TrendCue({ delta, className }: { delta: number | null; className?: string }) {
  const trend = describeTrend(delta)
  return <span className={cn('inline-flex items-center gap-1 text-sm font-medium', trend.direction === 'up' && 'text-success', trend.direction === 'down' && 'text-error', trend.direction === 'flat' && 'text-text-muted', className)} aria-label={trend.label}>
    <span aria-hidden="true">{trend.symbol}</span>{trend.label}
  </span>
}
