export const MARKET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Nashville CBD': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Dubai': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Hamburg': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
}

export function MarketChip({ name }: { name: string }) {
  const colors = MARKET_COLORS[name] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
      {name}
    </span>
  )
}

export function formatValue(value: number, metric: 'OCCUPANCY' | 'ADR') {
  if (metric === 'OCCUPANCY') return value.toFixed(2)
  return `$${value.toFixed(2)}`
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface ActualsStatusEntry {
  roundId: string
  marketId: string
  weekOffset: number
  hasOccupancy: boolean
  hasADR: boolean
}

export interface SingleEntryFormData {
  roundId: string
  marketId: string
  weekOffset: string
  occupancy: string
  adr: string
}
