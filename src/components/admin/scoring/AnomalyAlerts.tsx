'use client'

import { useEffect, useState, useCallback } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, XCircle, TrendingUp, Database, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

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
    fetchAnomalies()
  }, [fetchAnomalies])

  if (loading) return null
  if (anomalies.length === 0) return null

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length
  const warningCount = anomalies.filter(a => a.severity === 'warning').length

  return (
    <Card className={criticalCount > 0 ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <AlertTriangle className={`h-5 w-5 ${criticalCount > 0 ? 'text-red-600' : 'text-amber-600'}`} />
            Anomaly Detection — Round {roundNumber}
          </span>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                {criticalCount} critical
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {warningCount} warning{warningCount !== 1 ? 's' : ''}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={fetchAnomalies}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {anomalies.map((anomaly, i) => {
          const Icon = typeIcons[anomaly.type]
          const isExpanded = expanded[i]
          return (
            <div
              key={i}
              className={`rounded-lg border p-3 ${
                anomaly.severity === 'critical'
                  ? 'border-red-200 bg-white'
                  : 'border-amber-200 bg-white'
              }`}
            >
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${anomaly.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
                  <span className="text-sm font-medium">{anomaly.message}</span>
                </div>
                {anomaly.details && (
                  isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {isExpanded && anomaly.details && (
                <p className="text-xs text-gray-600 mt-2 ml-6">{anomaly.details}</p>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
