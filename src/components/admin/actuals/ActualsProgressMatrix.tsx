'use client'

import type { RoundSummary, MarketSummary, ActualSummary } from '@/features/actuals/types'
import type { ActualsStatusEntry } from './actuals-types'
import { MarketChip, formatDate } from './actuals-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
            <CheckCircle className="h-5 w-5 text-success" />
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
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-success transition-all duration-300"
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
                <div key={round.id} className="overflow-hidden rounded-lg border border-border">
                  <button
                    onClick={() => onToggleRound(round.id)}
                    className="flex w-full items-center justify-between p-3 transition-colors hover:bg-muted/70"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-text-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-text-muted" />
                      )}
                      <span className="font-medium">
                        Round {round.number}{round.isFinal ? ' (Final)' : ''}
                      </span>
                      <div className="flex gap-1">
                        {round.isLockedActuals && (
                          <Badge variant="neutral" className="gap-1 px-2 py-0.5">
                            <Lock className="h-3 w-3" />
                            Locked
                          </Badge>
                        )}
                        {round.scoresStale && (
                          <Badge variant="warning" className="gap-1 px-2 py-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            Stale
                          </Badge>
                        )}
                        {round.lastScoredAt && !round.scoresStale && (
                          <Badge variant="success" className="gap-1 px-2 py-0.5">
                            <CheckCircle className="h-3 w-3" />
                            Scored
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all duration-300 ${
                            stats.percentage === 100 ? 'bg-success' : 'bg-primary'
                          }`}
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        stats.percentage === 100 ? 'text-success' : 'text-text-secondary'
                      }`}>
                        {stats.complete}/{stats.total}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border bg-surface-secondary p-3">
                      <div className="flex gap-2 mb-3">
                        {round.isLockedActuals ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onShowUnlock(round.id)}
                            disabled={actionLoading === round.id}
                            className="border-warning/20 bg-warning-background/60 text-warning hover:bg-warning-background"
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
                          <span className="flex items-center gap-1 text-xs text-text-muted">
                            <Clock className="h-3 w-3" />
                            Last scored: {formatDate(round.lastScoredAt)}
                          </span>
                        )}
                      </div>

                      {roundActuals.length === 0 ? (
                        <p className="py-2 text-center text-sm text-text-muted">No actuals entered</p>
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
                                    hasData ? 'border-success/20 bg-card' : 'border-border bg-muted'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <MarketChip name={market.name} />
                                    <span className="text-text-muted">W+{weekOffset}</span>
                                  </div>
                                  {hasData ? (
                                    <div className="text-text-secondary">
                                      {occ && <div>Occ: {occ.value.toFixed(2)}</div>}
                                      {adr && <div>ADR: ${adr.value.toFixed(2)}</div>}
                                    </div>
                                  ) : (
                                    <div className="text-text-muted">Not entered</div>
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
