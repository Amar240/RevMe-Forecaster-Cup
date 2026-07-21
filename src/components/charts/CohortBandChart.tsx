'use client'

import { formatMape } from '@/lib/learning-analytics'

type Point = { round: number; q1: number | null; median: number | null; q3: number | null; team: number | null }

export function CohortBandChart({ data }: { data: Point[] }) {
  const values = data.flatMap((item) => [item.q1, item.median, item.q3, item.team]).filter((value): value is number => value != null)
  if (data.length < 2 || !values.length) return <p className="text-sm text-text-muted">Cohort trend appears after two published rounds.</p>
  const min = Math.min(...values) * 0.9
  const max = Math.max(...values) * 1.1
  const y = (value: number) => 90 - ((value - min) / (max - min || 1)) * 76
  const x = (index: number) => 8 + (index / (data.length - 1)) * 84
  const points = (key: 'median' | 'team') => data.flatMap((item, index) => item[key] == null ? [] : [`${x(index)},${y(item[key]!)}`]).join(' ')
  const upper = data.flatMap((item, index) => item.q3 == null ? [] : [`${x(index)},${y(item.q3)}`])
  const lower = data.slice().reverse().flatMap((item, reverseIndex) => item.q1 == null ? [] : [`${x(data.length - reverseIndex - 1)},${y(item.q1)}`])
  return <div><svg viewBox="0 0 100 105" role="img" aria-label={data.map((item) => `Round ${item.round}: team ${formatMape(item.team)}, cohort median ${formatMape(item.median)}`).join('. ')} className="h-64 w-full overflow-visible"><polygon points={[...upper, ...lower].join(' ')} className="fill-primary/10" /><polyline points={points('median')} fill="none" className="stroke-text-muted" strokeDasharray="3 2" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /><polyline points={points('team')} fill="none" className="stroke-primary" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />{data.map((item, index) => <text key={item.round} x={x(index)} y="102" textAnchor="middle" className="fill-text-muted text-[4px]">R{item.round}</text>)}</svg><div className="flex flex-wrap gap-4 text-xs text-text-secondary"><span><i className="mr-2 inline-block h-0.5 w-5 bg-primary" />Your MAPE</span><span><i className="mr-2 inline-block h-0.5 w-5 border-t border-dashed border-text-muted" />Cohort median</span><span><i className="mr-2 inline-block h-3 w-5 bg-primary/10" />Middle 50%</span></div></div>
}
