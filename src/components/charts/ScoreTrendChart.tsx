'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
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

export function ScoreTrendChart({ data, height = 300 }: ScoreTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No score data available yet</p>
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
    const occ = payload.find((p) => p.name === 'Occupancy MAPE')?.value
    const adr = payload.find((p) => p.name === 'ADR MAPE')?.value
    const hasOcc = typeof occ === 'number'
    const hasAdr = typeof adr === 'number'
    const finalValue = hasOcc && hasAdr ? (occ + adr) / 2 : null

    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 shadow-sm">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</div>
        {hasOcc && <div className="text-sm text-blue-600">Occupancy MAPE: {formatPercent(occ)}</div>}
        {hasAdr && <div className="text-sm text-emerald-600">ADR MAPE: {formatPercent(adr)}</div>}
        {finalValue !== null && (
          <div className="text-sm text-amber-600">Final MAPE: {formatPercent(finalValue)}</div>
        )}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="round" 
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis 
          tick={{ fontSize: 12, fill: '#6b7280' }}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <Tooltip content={renderTooltip} />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="occupancy" 
          stroke="#2563eb" 
          strokeWidth={2}
          dot={{ fill: '#2563eb', strokeWidth: 2 }}
          name="Occupancy MAPE"
        />
        <Line 
          type="monotone" 
          dataKey="adr" 
          stroke="#059669" 
          strokeWidth={2}
          dot={{ fill: '#059669', strokeWidth: 2 }}
          name="ADR MAPE"
        />
        <Line 
          type="monotone" 
          dataKey="final" 
          stroke="#f59e0b" 
          strokeWidth={2}
          dot={{ fill: '#f59e0b', strokeWidth: 2 }}
          name="Final MAPE"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
