import { Badge } from '@/components/ui/badge'

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
  Open: 'success',
  'Closing Soon': 'warning',
  Closed: 'neutral',
  Upcoming: 'info',
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANTS[status] || 'info'}>{status}</Badge>
}
