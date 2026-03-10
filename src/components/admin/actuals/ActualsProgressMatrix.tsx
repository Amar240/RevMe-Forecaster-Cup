'use client'

import type { RoundSummary, MarketSummary, ActualSummary } from '@/features/actuals/types'
import type { ActualsStatusEntry } from './actuals-types'
import { MarketChip, formatDate } from './actuals-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
  AlertTriangle,
  Clock,
} from 'lucide-react'

interface ActualsProgressMatrixProps {
  rounds: RoundSummary[]
  markets: MarketSummary[]
  statusActuals: ActualSummary[]
  actualsStatus: ActualsStatusEntry[]
  progressStats: { total: number; complete: number; percentage: number }
  roundStats: Record<string, { total: number; complete: number; percentage: number }>
  expandedRounds: Set<string>
  onToggleRound: (roundId: string) => void
  onLockRound: (roundId: string) => void
  onShowUnlock: (roundId: string) => void
  actionLoading: string | null
}

export function ActualsProgressMatrix({
  rounds, markets, statusActuals,
  progressStats, roundStats,
  expandedRounds, onToggleRound, onLockRound, onShowUnlock,
  actionLoading,
}: ActualsProgressMatrixProps) {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Upload Status
          </CardTitle>
          <CardDescription>Track which actuals have been entered for each round</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Overall Progress</span>
              <span className="font-medium">{progressStats.complete}/{progressStats.total}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${progressStats.percentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            {rounds.map((round) => {
              const stats = roundStats[round.id] || { total: 0, complete: 0, percentage: 0 }
              const isExpanded = expandedRounds.has(round.id)
              const roundActuals = statusActuals.filter(a => a.roundId === round.id && !a.isVoided)

              return (
                <div key={round.id} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => onToggleRound(round.id)}
                    className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="font-medium">
                        Round {round.number}{round.isFinal ? ' (Final)' : ''}
                      </span>
                      <div className="flex gap-1">
                        {round.isLockedActuals && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                            <Lock className="h-3 w-3" />
                            Locked
                          </span>
                        )}
                        {round.scoresStale && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Stale
                          </span>
                        )}
                        {round.lastScoredAt && !round.scoresStale && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3" />
                            Scored
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            stats.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        stats.percentage === 100 ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {stats.complete}/{stats.total}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t bg-gray-50 p-3">
                      <div className="flex gap-2 mb-3">
                        {round.isLockedActuals ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onShowUnlock(round.id)}
                            disabled={actionLoading === round.id}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                          >
                            <Unlock className="h-4 w-4 mr-1" />
                            Unlock (Override)
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onLockRound(round.id)}
                            disabled={actionLoading === round.id}
                          >
                            <Lock className="h-4 w-4 mr-1" />
                            Lock Actuals
                          </Button>
                        )}
                        {round.lastScoredAt && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last scored: {formatDate(round.lastScoredAt)}
                          </span>
                        )}
                      </div>

                      {roundActuals.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-2">No actuals entered</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {markets.map((market) => {
                            const weekOffsets = round.isFinal ? [1] : [1, 2]
                            return weekOffsets.map((weekOffset) => {
                              const occ = roundActuals.find(
                                a => a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'OCCUPANCY'
                              )
                              const adr = roundActuals.find(
                                a => a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'ADR'
                              )
                              const hasData = occ || adr

                              return (
                                <div
                                  key={`${market.id}-${weekOffset}`}
                                  className={`p-2 rounded border ${
                                    hasData ? 'bg-white border-green-200' : 'bg-gray-100 border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <MarketChip name={market.name} />
                                    <span className="text-gray-500">W+{weekOffset}</span>
                                  </div>
                                  {hasData ? (
                                    <div className="text-gray-600">
                                      {occ && <div>Occ: {occ.value.toFixed(2)}</div>}
                                      {adr && <div>ADR: ${adr.value.toFixed(2)}</div>}
                                    </div>
                                  ) : (
                                    <div className="text-gray-400">Not entered</div>
                                  )}
                                </div>
                              )
                            })
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
