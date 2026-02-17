'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Target, 
  RefreshCw, 
  TrendingUp, 
  Filter,
  ChevronDown,
  ChevronUp,
  BarChart3
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

export default function ScoringVerificationPage() {
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [rounds, setRounds] = useState<RoundOption[]>([])
  const [markets, setMarkets] = useState<MarketOption[]>([])
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [seasonName, setSeasonName] = useState('')
  const [canSelectTeam, setCanSelectTeam] = useState(false)
  
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [selectedRound, setSelectedRound] = useState<string>('')
  const [selectedMarket, setSelectedMarket] = useState<string>('')
  const [selectedMetric, setSelectedMetric] = useState<string>('')
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set())
  const [initialLoad, setInitialLoad] = useState(true)

  const fetchData = useCallback(async () => {
    if (!initialLoad) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedTeam) params.set('teamId', selectedTeam)
      if (selectedRound) params.set('roundId', selectedRound)
      
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
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [initialLoad, selectedTeam, selectedRound])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      if (selectedMarket && p.marketId !== selectedMarket) return false
      if (selectedMetric && p.metric !== selectedMetric) return false
      return true
    })
  }, [predictions, selectedMarket, selectedMetric])

  const groupedByRound = useMemo(() => {
    const groups: Record<string, Prediction[]> = {}
    filteredPredictions.forEach((p) => {
      if (!groups[p.roundId]) {
        groups[p.roundId] = []
      }
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
      const finalMAPE = (occupancyMAPE + adrMAPE) / 2

      stats[roundId] = {
        occupancyMAPE,
        adrMAPE,
        finalMAPE,
        count: preds.length,
      }
    })

    return stats
  }, [groupedByRound])

  const toggleRound = (roundId: string) => {
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(roundId)) {
        next.delete(roundId)
      } else {
        next.add(roundId)
      }
      return next
    })
  }

  const handleTeamChange = (teamId: string) => {
    setSelectedTeam(teamId)
  }
  
  const handleRoundChange = (roundId: string) => {
    setSelectedRound(roundId)
  }

  const formatValue = (value: number, metric: string) => {
    if (metric === 'OCCUPANCY') {
      return value.toFixed(2)
    }
    return `$${value.toFixed(2)}`
  }

  const calculateAPE = (absError: number, actualValue: number) => {
    if (actualValue === 0) return 0
    return (absError / actualValue) * 100
  }

  const formatAPE = (ape: number) => {
    return `${ape.toFixed(2)}%`
  }

  const getErrorColor = (ape: number) => {
    if (ape < 10) return 'text-green-600 bg-green-50'
    if (ape < 25) return 'text-amber-600 bg-amber-50'
    return 'text-red-600 bg-red-50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scoring Verification</h1>
          <p className="text-gray-600">{seasonName || 'Review predictions vs actual values'}</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-blue-600" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            {canSelectTeam && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Team</label>
                <select
                  value={selectedTeam}
                  onChange={(e) => handleTeamChange(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Teams</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Round</label>
              <select
                value={selectedRound}
                onChange={(e) => handleRoundChange(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Rounds</option>
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Market</label>
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Markets</option>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Metric</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Both</option>
                <option value="OCCUPANCY">Occupancy</option>
                <option value="ADR">ADR</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredPredictions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Scored Predictions Yet</h3>
            <p className="text-gray-500">
              Predictions will appear here after actuals are uploaded and scoring is run.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rounds.filter(r => groupedByRound[r.id]).map((round) => {
            const isExpanded = expandedRounds.has(round.id)
            const stats = roundStats[round.id]
            const roundPreds = groupedByRound[round.id] || []
            
            return (
              <Card key={round.id}>
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleRound(round.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <CardTitle className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-blue-600" />
                        <span>{round.label}</span>
                      </CardTitle>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-500">
                          {roundPreds.length} predictions
                        </span>
                        {stats && (
                          <>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              Occ MAPE: {stats.occupancyMAPE.toFixed(2)}%
                            </span>
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                              ADR MAPE: {stats.adrMAPE.toFixed(2)}%
                            </span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">
                              Final MAPE: {stats.finalMAPE.toFixed(2)}%
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
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
                            <tr key={pred.id} className="border-b border-gray-50 hover:bg-gray-50">
                              {canSelectTeam && (
                                <td className="py-2 text-gray-900 font-medium">{pred.teamName}</td>
                              )}
                              <td className="py-2 text-gray-900">{pred.marketName}</td>
                              <td className="py-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  pred.metric === 'OCCUPANCY' 
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {pred.metric}
                                </span>
                              </td>
                              <td className="py-2 text-gray-600">
                                Week +{pred.weekOffset}
                              </td>
                              <td className="py-2 text-right font-mono">
                                {formatValue(pred.predictedValue, pred.metric)}
                              </td>
                              <td className="py-2 text-right font-mono">
                                {formatValue(pred.actualValue, pred.metric)}
                              </td>
                              <td className="py-2 text-right">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${getErrorColor(calculateAPE(pred.absError, pred.actualValue))}`}>
                                  {formatAPE(calculateAPE(pred.absError, pred.actualValue))}
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

      <Card className="bg-gray-50">
        <CardContent className="py-4">
          <div className="flex items-start space-x-3">
            <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-1">Understanding Scores</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>MAPE</strong> = Mean Absolute Percentage Error (average of percentage errors)</li>
                <li><strong>APE</strong> = |Predicted - Actual| / Actual × 100% for each prediction</li>
                <li>Lower errors indicate better predictions</li>
                <li>Green = excellent, Yellow = moderate, Red = needs improvement</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}




