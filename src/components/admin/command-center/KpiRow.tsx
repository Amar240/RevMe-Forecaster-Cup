import { AlertTriangle, Send, ShieldCheck, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CommandCenterDisplay } from './command-center-display'

const KPI_STYLES: Record<CommandCenterDisplay['kpis'][number]['tone'], string> = {
  neutral: 'border-border bg-card',
  info: 'border-primary/10 bg-gradient-to-br from-primary-soft to-card',
  success: 'border-success/15 bg-gradient-to-br from-success-background to-card',
  warning: 'border-warning/15 bg-gradient-to-br from-warning-background to-card',
  error: 'border-error/15 bg-gradient-to-br from-error-background to-card',
}

const VALUE_STYLES: Record<CommandCenterDisplay['kpis'][number]['tone'], string> = {
  neutral: 'text-foreground',
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

const KPI_ICONS = {
  'active-teams': Users,
  'submitted-this-round': Send,
  'teams-at-risk': AlertTriangle,
  'scoring-status': ShieldCheck,
} as const

export function KpiRow({ display }: { display: CommandCenterDisplay }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {display.kpis.map((kpi) => {
        const Icon = KPI_ICONS[kpi.id as keyof typeof KPI_ICONS] ?? Users

        return (
          <Card key={kpi.id} variant="metric" className={KPI_STYLES[kpi.tone]}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                <Icon className={`h-4 w-4 ${VALUE_STYLES[kpi.tone]}`} />
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-semibold tracking-tight ${VALUE_STYLES[kpi.tone]}`}>
                {kpi.value}
              </p>
              <p className="mt-1 text-xs text-text-secondary">{kpi.subtitle}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
