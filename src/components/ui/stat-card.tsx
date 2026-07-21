import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({ title, value, description, icon, className }: { title: ReactNode; value: ReactNode; description?: ReactNode; icon?: ReactNode; className?: string }) {
  return <Card variant="metric" className={className}>
    <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-text-secondary">{title}</CardTitle>{icon}</CardHeader>
    <CardContent><div className={cn('font-display text-4xl font-semibold tabular-nums text-foreground')}>{value}</div>{description && <div className="mt-1 text-sm text-text-secondary">{description}</div>}</CardContent>
  </Card>
}
