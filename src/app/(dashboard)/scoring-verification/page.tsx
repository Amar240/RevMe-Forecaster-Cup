'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Target,
  RefreshCw,
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3,
  LayoutGrid,
  List,
  Download,
  ArrowUpDown,
} from 'lucide-react'

interface Prediction {
  id: string
  roundId: string
  roundNumber: number
  roundLabel: string
  marketId: string
  marketName: string
  teamId: string
  teamName: string
  metric: 'OCCUPANCY' | 'ADR'
  weekOffset: number
  predictedValue: number
  actualValue: number
  absError: number
}

interface RoundOption {
  id: string
  number: number
  isFinal: boolean
  label: string
}

interface MarketOption {
  id: string
  name: string
}

interface TeamOption {
  id: string
  name: string
}

type ViewStyle = 'detailed' | 'comparison'
type SortField = 'team' | 'mape'
type SortDir = 'asc' | 'desc'

interface PivotRow {
  teamId: string
  teamName: string
  roundId: string
  roundLabel: string
  mape: number
  cells: Record<string, { pred: number; actual: number; ape: number; metric: 'OCCUPANCY' | 'ADR' }>
}

function getHeatmapClasses(ape: number): string {
  if (ape < 5) return 'bg-success-background text-success dark:bg-success-background dark:text-success'
  if (ape < 15) return 'bg-warning-background text-warning dark:bg-warning-background dark:text-warning'
  if (ape < 30) return 'bg-warning-background text-warning dark:bg-warning-background dark:text-warning'
  return 'bg-error-background text-error dark:bg-error-background dark:text-error'
}

function getErrorColor(ape: number): string {
  if (ape < 10) return 'text-success bg-success-background'
  if (ape < 25) return 'text-warning bg-warning-background'
  return 'text-error bg-error-background'
}

function calculateAPE(absError: number, actualValue: number): number {
  if (actualValue === 0) return 0
  return (absError / actualValue) * 100
}

function formatValue(value: number, metric: string): string {
  if (metric === 'OCCUPANCY') return value.toFixed(2)
  return `$${value.toFixed(2)}`
}

export default function ScoringVerificationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [rounds, setRounds] = useState<RoundOption[]>([])
  const [markets, setMarkets] = useState<MarketOption[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [seasonName, setSeasonName] = useState('')
  const [canSelectTeam, setCanSelectTeam] = useState(false)

  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedRound, setSelectedRound] = useState<string>('all')
  const [selectedMarket, setSelectedMarket] = useState<string>('all')
  const [selectedMetric, setSelectedMetric] = useState<string>('all')
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set())
  const [initialLoad, setInitialLoad] = useState(true)
  const [viewStyle, setViewStyle] = useState<ViewStyle>('detailed')
  const [sortField, setSortField] = useState<SortField>('mape')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [accessChecked, setAccessChecked] = useState(false)

  const fetchData = useCallback(async () => {
    if (!initialLoad) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedTeam && selectedTeam !== 'all') params.set('teamId', selectedTeam)
      if (selectedRound && selectedRound !== 'all') params.set('roundId', selectedRound)

      const res = await csrfFetch(`/api/scoring/verification?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPredictions(data.predictions || [])
        setRounds(data.rounds || [])
        setMarkets(data.markets || [])
        setTeams(data.teams || [])
        setSeasonName(data.seasonName || '')
        setCanSelectTeam(data.canSelectTeam)
        if (data.selectedTeamId && initialLoad) {
          setSelectedTeam(data.selectedTeamId)
        }
      }
    } catch (err) {
      clientLogger.error('Failed to fetch verification data:', err)
      toast.error('Failed to load verification data')
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [initialLoad, selectedTeam, selectedRound])

  useEffect(() => {
    csrfFetch('/api/auth/me').then(async (response) => {
      if (!response.ok) return router.replace('/login')
      const role = (await response.json()).user?.role
      if (role !== 'ADMIN' && role !== 'SUB_ADMIN') return router.replace('/scores?tab=round')
      setAccessChecked(true)
      void fetchData()
    }).catch(() => router.replace('/scores?tab=round'))
  }, [fetchData, router])

  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      if (selectedMarket && selectedMarket !== 'all' && p.marketId !== selectedMarket) return false
      if (selectedMetric && selectedMetric !== 'all' && p.metric !== selectedMetric) return false
      return true
    })
  }, [predictions, selectedMarket, selectedMetric])

  const groupedByRound = useMemo(() => {
    const groups: Record<string, Prediction[]> = {}
    filteredPredictions.forEach((p) => {
      if (!groups[p.roundId]) groups[p.roundId] = []
      groups[p.roundId].push(p)
    })
    return groups
  }, [filteredPredictions])

  const roundStats = useMemo(() => {
    const stats: Record<string, { occupancyMAPE: number; adrMAPE: number; finalMAPE: number; count: number }> = {}
    Object.entries(groupedByRound).forEach(([roundId, preds]) => {
      const occPreds = preds.filter(p => p.metric === 'OCCUPANCY' && p.actualValue !== 0)
      const adrPreds = preds.filter(p => p.metric === 'ADR' && p.actualValue !== 0)
      const occAPEs = occPreds.map(p => (p.absError / p.actualValue) * 100)
      const adrAPEs = adrPreds.map(p => (p.absError / p.actualValue) * 100)
      const occupancyMAPE = occAPEs.length > 0 ? occAPEs.reduce((a, b) => a + b, 0) / occAPEs.length : 0
      const adrMAPE = adrAPEs.length > 0 ? adrAPEs.reduce((a, b) => a + b, 0) / adrAPEs.length : 0
      stats[roundId] = { occupancyMAPE, adrMAPE, finalMAPE: (occupancyMAPE + adrMAPE) / 2, count: preds.length }
    })
    return stats
  }, [groupedByRound])

  // --- Pivot data for comparison view ---
  const pivotColumnKeys = useMemo(() => {
    const keys: { key: string; marketName: string; metric: 'OCCUPANCY' | 'ADR'; weekOffset: number }[] = []
    const marketNames = [...new Set(filteredPredictions.map(p => p.marketName))].sort()
    const weekOffsets = [...new Set(filteredPredictions.map(p => p.weekOffset))].sort((a, b) => a - b)
    const metricsToShow: ('OCCUPANCY' | 'ADR')[] =
      selectedMetric === 'OCCUPANCY' ? ['OCCUPANCY'] : selectedMetric === 'ADR' ? ['ADR'] : ['OCCUPANCY', 'ADR']
    for (const mn of marketNames) {
      for (const wo of weekOffsets) {
        for (const mt of metricsToShow) {
          keys.push({ key: `${mn}_${mt}_W${wo}`, marketName: mn, metric: mt, weekOffset: wo })
        }
      }
    }
    return keys
  }, [filteredPredictions, selectedMetric])

  const pivotRows = useMemo(() => {
    const grouped = new Map<string, PivotRow>()
    for (const pred of filteredPredictions) {
      const rowKey = `${pred.teamId}__${pred.roundId}`
      if (!grouped.has(rowKey)) {
        grouped.set(rowKey, {
          teamId: pred.teamId,
          teamName: pred.teamName,
          roundId: pred.roundId,
          roundLabel: pred.roundLabel,
          mape: 0,
          cells: {},
        })
      }
      const row = grouped.get(rowKey)!
      const cellKey = `${pred.marketName}_${pred.metric}_W${pred.weekOffset}`
      row.cells[cellKey] = {
        pred: pred.predictedValue,
        actual: pred.actualValue,
        ape: calculateAPE(pred.absError, pred.actualValue),
        metric: pred.metric,
      }
    }
    for (const row of grouped.values()) {
      const apes = Object.values(row.cells).filter(c => c.actual !== 0).map(c => c.ape)
      row.mape = apes.length > 0 ? apes.reduce((a, b) => a + b, 0) / apes.length : 0
    }
    const rows = Array.from(grouped.values())
    rows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortField === 'team') return dir * a.teamName.localeCompare(b.teamName)
      return dir * (a.mape - b.mape)
    })
    return rows
  }, [filteredPredictions, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const toggleRound = (roundId: string) => {
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(roundId)) next.delete(roundId)
      else next.add(roundId)
      return next
    })
  }

  // --- CSV export ---
  const exportCSV = () => {
    let csvContent = ''
    if (viewStyle === 'detailed') {
      const headers = ['Round', ...(canSelectTeam ? ['Team'] : []), 'Market', 'Metric', 'Week', 'Predicted', 'Actual', 'APE']
      csvContent = headers.join(',') + '\n'
      for (const pred of filteredPredictions) {
        const ape = calculateAPE(pred.absError, pred.actualValue)
        const row = [
          pred.roundLabel,
          ...(canSelectTeam ? [pred.teamName] : []),
          pred.marketName,
          pred.metric,
          `W+${pred.weekOffset}`,
          pred.predictedValue.toFixed(2),
          pred.actualValue.toFixed(2),
          ape.toFixed(2) + '%',
        ]
        csvContent += row.join(',') + '\n'
      }
    } else {
      const headers = ['Team', 'Round', 'MAPE', ...pivotColumnKeys.map(k => {
        const shortMetric = k.metric === 'OCCUPANCY' ? 'Occ' : 'ADR'
        return `${k.marketName} ${shortMetric} W+${k.weekOffset}`
      })]
      csvContent = headers.join(',') + '\n'
      for (const row of pivotRows) {
        const cells = [
          row.teamName,
          row.roundLabel,
          row.mape.toFixed(2) + '%',
          ...pivotColumnKeys.map(k => {
            const cell = row.cells[k.key]
            if (!cell) return '--'
            return `${cell.pred.toFixed(2)}/${cell.actual.toFixed(2)} (${cell.ape.toFixed(1)}%)`
          }),
        ]
        csvContent += cells.join(',') + '\n'
      }
    }
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scoring-verification-${viewStyle}.csv`
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    a.remove()
  }

  if (!accessChecked) return <div className="py-16 text-center text-text-secondary">Checking score access…</div>

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div className="max-w-[90rem] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground dark:text-text-muted">Scoring Verification</h1>
          <p className="text-text-secondary dark:text-text-muted">{seasonName || 'Review predictions vs actual values'}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-info" />
              <span>Filters</span>
            </CardTitle>
            <div className="flex items-center bg-surface-secondary dark:bg-muted rounded-lg p-1">
              <button
                onClick={() => setViewStyle('detailed')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewStyle === 'detailed'
                    ? 'bg-white dark:bg-muted shadow text-foreground dark:text-text-muted'
                    : 'text-text-secondary dark:text-text-muted hover:text-foreground dark:hover:text-text-muted'
                }`}
              >
                <List className="h-4 w-4" />
                <span>Detailed</span>
              </button>
              <button
                onClick={() => setViewStyle('comparison')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewStyle === 'comparison'
                    ? 'bg-white dark:bg-muted shadow text-foreground dark:text-text-muted'
                    : 'text-text-secondary dark:text-text-muted hover:text-foreground dark:hover:text-text-muted'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                <span>Comparison</span>
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            {canSelectTeam && (
              <div className="space-y-1">
                <Label>Team</Label>
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger><SelectValue placeholder="All Teams" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Round</Label>
              <Select value={selectedRound} onValueChange={setSelectedRound}>
                <SelectTrigger><SelectValue placeholder="All Rounds" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rounds</SelectItem>
                  {rounds.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Market</Label>
              <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                <SelectTrigger><SelectValue placeholder="All Markets" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Markets</SelectItem>
                  {markets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Metric</Label>
              <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                <SelectTrigger><SelectValue placeholder="Both" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Both</SelectItem>
                  <SelectItem value="OCCUPANCY">Occupancy</SelectItem>
                  <SelectItem value="ADR">ADR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredPredictions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground dark:text-text-muted mb-2">No Scored Predictions Yet</h3>
            <p className="text-text-muted dark:text-text-muted">
              Predictions will appear here after actuals are uploaded and scoring is run.
            </p>
          </CardContent>
        </Card>
      ) : viewStyle === 'comparison' ? (
        /* ========= COMPARISON / PIVOT VIEW ========= */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary dark:bg-muted border-b dark:border-border">
                    <th
                      className="px-4 py-3 text-left font-medium text-text-muted dark:text-text-muted sticky left-0 bg-surface-secondary dark:bg-muted z-10 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort('team')}
                    >
                      <span className="flex items-center space-x-1">
                        <span>Team</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-text-muted dark:text-text-muted whitespace-nowrap">Round</th>
                    <th
                      className="px-3 py-3 text-right font-medium text-text-muted dark:text-text-muted cursor-pointer select-none whitespace-nowrap"
                      onClick={() => toggleSort('mape')}
                    >
                      <span className="flex items-center justify-end space-x-1">
                        <span>MAPE</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    {pivotColumnKeys.map((col) => {
                      const shortMetric = col.metric === 'OCCUPANCY' ? 'Occ' : 'ADR'
                      return (
                        <th
                          key={col.key}
                          className="px-3 py-3 text-center font-medium text-text-muted dark:text-text-muted whitespace-nowrap min-w-[120px]"
                        >
                          <div className="text-xs leading-tight">
                            <div>{col.marketName}</div>
                            <div className="text-text-muted dark:text-text-muted">{shortMetric} W+{col.weekOffset}</div>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((row) => (
                    <tr key={`${row.teamId}-${row.roundId}`} className="border-b dark:border-border hover:bg-surface-secondary dark:hover:bg-muted">
                      <td className="px-4 py-2.5 font-medium text-foreground dark:text-text-muted sticky left-0 bg-white dark:bg-muted z-10 whitespace-nowrap">
                        {row.teamName}
                      </td>
                      <td className="px-3 py-2.5 text-text-secondary dark:text-text-muted whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-info-background dark:bg-info-background text-info dark:text-info rounded text-xs font-medium">
                          {row.roundLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getErrorColor(row.mape)}`}>
                          {row.mape.toFixed(2)}%
                        </span>
                      </td>
                      {pivotColumnKeys.map((col) => {
                        const cell = row.cells[col.key]
                        if (!cell) {
                          return (
                            <td key={col.key} className="px-3 py-2.5 text-center text-text-muted dark:text-text-secondary">
                              --
                            </td>
                          )
                        }
                        const fmtPred = col.metric === 'OCCUPANCY' ? cell.pred.toFixed(1) : `$${cell.pred.toFixed(0)}`
                        const fmtActual = col.metric === 'OCCUPANCY' ? cell.actual.toFixed(1) : `$${cell.actual.toFixed(0)}`
                        return (
                          <td key={col.key} className={`px-3 py-2.5 text-center ${getHeatmapClasses(cell.ape)}`}>
                            <div className="text-xs leading-tight font-mono">
                              <div>{fmtPred} / {fmtActual}</div>
                              <div className="font-semibold">{cell.ape.toFixed(1)}%</div>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ========= DETAILED / FLAT VIEW ========= */
        <div className="space-y-4">
          {rounds.filter(r => groupedByRound[r.id]).map((round) => {
            const isExpanded = expandedRounds.has(round.id)
            const stats = roundStats[round.id]
            const roundPreds = groupedByRound[round.id] || []

            return (
              <Card key={round.id}>
                <CardHeader
                  className="cursor-pointer hover:bg-surface-secondary dark:hover:bg-muted transition-colors"
                  onClick={() => toggleRound(round.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <CardTitle className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-info" />
                        <span>{round.label}</span>
                      </CardTitle>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-text-muted dark:text-text-muted">
                          {roundPreds.length} predictions
                        </span>
                        {stats && (
                          <>
                            <span className="px-2 py-1 bg-info-background dark:bg-info-background text-info dark:text-info rounded">
                              Occ MAPE: {stats.occupancyMAPE.toFixed(2)}%
                            </span>
                            <span className="px-2 py-1 bg-success-background dark:bg-success-background text-success dark:text-success rounded">
                              ADR MAPE: {stats.adrMAPE.toFixed(2)}%
                            </span>
                            <span className="px-2 py-1 bg-warning-background dark:bg-warning-background text-warning dark:text-warning rounded">
                              Final MAPE: {stats.finalMAPE.toFixed(2)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-text-muted" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-text-muted" />
                    )}
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-text-muted dark:text-text-muted">
                            {canSelectTeam && <th className="pb-2 font-medium">Team</th>}
                            <th className="pb-2 font-medium">Market</th>
                            <th className="pb-2 font-medium">Metric</th>
                            <th className="pb-2 font-medium">Week</th>
                            <th className="pb-2 font-medium text-right">Predicted</th>
                            <th className="pb-2 font-medium text-right">Actual</th>
                            <th className="pb-2 font-medium text-right">APE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roundPreds.map((pred) => (
                            <tr key={pred.id} className="border-b border-border dark:border-border hover:bg-surface-secondary dark:hover:bg-muted">
                              {canSelectTeam && (
                                <td className="py-2 text-foreground dark:text-text-muted font-medium">{pred.teamName}</td>
                              )}
                              <td className="py-2 text-foreground dark:text-text-muted">{pred.marketName}</td>
                              <td className="py-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  pred.metric === 'OCCUPANCY'
                                    ? 'bg-info-background text-info dark:bg-info-background dark:text-info'
                                    : 'bg-success-background text-success dark:bg-success-background dark:text-success'
                                }`}>
                                  {pred.metric}
                                </span>
                              </td>
                              <td className="py-2 text-text-secondary dark:text-text-muted">Week +{pred.weekOffset}</td>
                              <td className="py-2 text-right font-mono">{formatValue(pred.predictedValue, pred.metric)}</td>
                              <td className="py-2 text-right font-mono">{formatValue(pred.actualValue, pred.metric)}</td>
                              <td className="py-2 text-right">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${getErrorColor(calculateAPE(pred.absError, pred.actualValue))}`}>
                                  {calculateAPE(pred.absError, pred.actualValue).toFixed(2)}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Card className="bg-surface-secondary dark:bg-muted">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <TrendingUp className="h-5 w-5 text-info mt-0.5" />
            <div className="text-sm text-text-secondary dark:text-text-muted">
              <p className="font-medium text-foreground dark:text-text-muted mb-1">Understanding Scores</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>MAPE</strong> = Mean Absolute Percentage Error (average of percentage errors)</li>
                <li><strong>APE</strong> = |Predicted - Actual| / Actual x 100% for each prediction</li>
                <li>Lower errors indicate better predictions</li>
                <li className="flex items-center space-x-3 list-none ml-[-1.25rem]">
                  <span className="inline-block w-3 h-3 rounded bg-success-background dark:bg-success"></span>
                  <span>&lt;5% Excellent</span>
                  <span className="inline-block w-3 h-3 rounded bg-warning-background dark:bg-warning"></span>
                  <span>5-15% Good</span>
                  <span className="inline-block w-3 h-3 rounded bg-warning-background dark:bg-warning"></span>
                  <span>15-30% Fair</span>
                  <span className="inline-block w-3 h-3 rounded bg-error-background dark:bg-error"></span>
                  <span>&gt;30% Needs work</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
