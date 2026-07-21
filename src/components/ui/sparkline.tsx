import { cn } from '@/lib/utils'

export function Sparkline({ values, label, className }: { values: number[]; label: string; className?: string }) {
  if (values.length < 2) return <span className="text-xs text-text-muted">Not enough history</span>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${28 - ((value - min) / range) * 24}`).join(' ')
  return <svg viewBox="0 0 100 32" role="img" aria-label={`${label}: ${values.map((value) => value.toFixed(1)).join(', ')}`} className={cn('h-10 w-full overflow-visible', className)} preserveAspectRatio="none"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" /><circle cx="100" cy={28 - ((values.at(-1)! - min) / range) * 24} r="2.5" fill="currentColor" vectorEffect="non-scaling-stroke" /></svg>
}
