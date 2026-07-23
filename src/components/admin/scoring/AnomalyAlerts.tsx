'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Database, RefreshCw, TrendingUp, XCircle } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Anomaly {
  type: 'high_error' | 'ranking_jump' | 'bad_actuals' | 'uniform_scores'
  severity: 'warning' | 'critical'
  message: string
  details?: string
}

const typeIcons = {
  high_error: TrendingUp,
  ranking_jump: TrendingUp,
  bad_actuals: Database,
  uniform_scores: XCircle,
}

export function AnomalyAlerts() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [roundNumber, setRoundNumber] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const fetchAnomalies = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/scoring/anomalies')
      if (res.ok) {
        const data = await res.json()
        setAnomalies(data.anomalies || [])
        setRoundNumber(data.roundNumber || null)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch anomalies:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAnomalies()
  }, [fetchAnomalies])

  if (loading || anomalies.length === 0) return null

  const criticalCount = anomalies.filter((anomaly) => anomaly.severity === 'critical').length
  const warningCount = anomalies.filter((anomaly) => anomaly.severity === 'warning').length

  return (
    <Card className={criticalCount > 0 ? 'border-error/20 bg-error-background' : 'border-warning/20 bg-warning-background'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <AlertTriangle className={`h-5 w-5 ${criticalCount > 0 ? 'text-error' : 'text-warning'}`} />
            Anomaly Detection - Round {roundNumber}
          </span>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && <Badge variant="error">{criticalCount} critical</Badge>}
            {warningCount > 0 && <Badge variant="warning">{warningCount} warning{warningCount !== 1 ? 's' : ''}</Badge>}
            <Button variant="ghost" size="sm" onClick={fetchAnomalies}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {anomalies.map((anomaly, index) => {
          const Icon = typeIcons[anomaly.type] ?? AlertTriangle
          const isExpanded = expanded[index]
          const variant = anomaly.severity === 'critical' ? 'error' : 'warning'

          return (
            <div key={index} className="rounded-lg border border-border bg-card p-3">
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${anomaly.severity === 'critical' ? 'text-error' : 'text-warning'}`} />
                  <span className="text-sm font-medium text-foreground">{anomaly.message}</span>
                  <Badge variant={variant}>{anomaly.severity}</Badge>
                </div>
                {anomaly.details &&
                  (isExpanded ? <ChevronUp className="h-4 w-4 text-text-muted" /> : <ChevronDown className="h-4 w-4 text-text-muted" />)}
              </button>
              {isExpanded && anomaly.details && <p className="ml-6 mt-2 text-xs text-text-secondary">{anomaly.details}</p>}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
