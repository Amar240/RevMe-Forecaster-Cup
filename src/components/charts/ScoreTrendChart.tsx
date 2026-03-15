'use client'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts/types/component/Tooltip'

interface ScoreData {
  round: string
  occupancy: number
  adr: number
}

interface ScoreTrendChartProps {
  data: ScoreData[]
  height?: number
}

const chartTheme = {
  grid: 'var(--border-default)',
  axis: 'var(--text-muted)',
  occupancy: 'var(--primary)',
  adr: 'var(--success)',
  final: 'var(--accent)',
}

export function ScoreTrendChart({ data, height = 300 }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-surface-secondary">
        <p className="text-muted-foreground">No score data available yet</p>
      </div>
    )
  }

  const chartData = data.map((point) => ({
    ...point,
    final: (point.occupancy + point.adr) / 2,
  }))

  const formatPercent = (value: number) => `${value.toFixed(2)}%`

  const renderTooltip = ({ active, payload, label }: TooltipContentProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null

    const occ = payload.find((item) => item.name === 'Occupancy MAPE')?.value
    const adr = payload.find((item) => item.name === 'ADR MAPE')?.value
    const hasOcc = typeof occ === 'number'
    const hasAdr = typeof adr === 'number'
    const finalValue = hasOcc && hasAdr ? (occ + adr) / 2 : null

    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-card">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {hasOcc && <div className="text-sm text-primary">Occupancy MAPE: {formatPercent(occ)}</div>}
        {hasAdr && <div className="text-sm text-success">ADR MAPE: {formatPercent(adr)}</div>}
        {finalValue !== null && <div className="text-sm text-accent">Final MAPE: {formatPercent(finalValue)}</div>}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
        <XAxis dataKey="round" tick={{ fontSize: 12, fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.grid }} tickLine={{ stroke: chartTheme.grid }} />
        <YAxis tick={{ fontSize: 12, fill: chartTheme.axis }} axisLine={{ stroke: chartTheme.grid }} tickLine={{ stroke: chartTheme.grid }} />
        <Tooltip content={renderTooltip} />
        <Legend wrapperStyle={{ color: 'var(--text-secondary)', fontSize: 12 }} />
        <Line type="monotone" dataKey="occupancy" stroke={chartTheme.occupancy} strokeWidth={2} dot={{ fill: chartTheme.occupancy, strokeWidth: 2 }} name="Occupancy MAPE" />
        <Line type="monotone" dataKey="adr" stroke={chartTheme.adr} strokeWidth={2} dot={{ fill: chartTheme.adr, strokeWidth: 2 }} name="ADR MAPE" />
        <Line type="monotone" dataKey="final" stroke={chartTheme.final} strokeWidth={2} dot={{ fill: chartTheme.final, strokeWidth: 2 }} name="Final MAPE" />
      </LineChart>
    </ResponsiveContainer>
  )
}
