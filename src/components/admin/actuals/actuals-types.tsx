export const MARKET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Nashville CBD': { bg: 'bg-primary-soft', text: 'text-primary', border: 'border-primary/20' },
  'BUR Dubai': { bg: 'bg-accent-soft', text: 'text-accent', border: 'border-accent/20' },
  'Hamburg Center': { bg: 'bg-info-background', text: 'text-info', border: 'border-info/20' },
}

export function MarketChip({ name }: { name: string }) {
  const colors = MARKET_COLORS[name] || { bg: 'bg-surface-secondary', text: 'text-text-secondary', border: 'border-border' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${colors.bg} ${colors.text} ${colors.border}`}>
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
