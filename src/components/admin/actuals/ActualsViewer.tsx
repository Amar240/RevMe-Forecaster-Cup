'use client'

import type { RoundSummary, MarketSummary, ActualSummary } from '@/features/actuals/types'
import { MarketChip, formatValue } from './actuals-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Edit2, Trash2, RotateCcw } from 'lucide-react'

interface ActualsViewerProps {
  filteredActuals: ActualSummary[]
  rounds: RoundSummary[]
  markets: MarketSummary[]
  viewSearch: string
  setViewSearch: (v: string) => void
  viewRoundId: string
  setViewRoundId: (v: string) => void
  viewMarketId: string
  setViewMarketId: (v: string) => void
  viewMetric: 'all' | 'OCCUPANCY' | 'ADR'
  setViewMetric: (v: 'all' | 'OCCUPANCY' | 'ADR') => void
  showVoided: boolean
  onToggleShowVoided: (checked: boolean) => void
  page: number
  totalPages: number
  totalActuals: number
  setPage: (fn: (current: number) => number) => void
  actionLoading: string | null
  onEdit: (actual: ActualSummary) => void
  onVoid: (actual: ActualSummary) => void
  onUnvoid: (actual: ActualSummary) => void
}

export function ActualsViewer({
  filteredActuals, rounds, markets,
  viewSearch, setViewSearch, viewRoundId, setViewRoundId,
  viewMarketId, setViewMarketId, viewMetric, setViewMetric,
  showVoided, onToggleShowVoided,
  page, totalPages, totalActuals, setPage,
  actionLoading, onEdit, onVoid, onUnvoid,
}: ActualsViewerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          View and manage all uploaded actuals
        </p>
        <Label className="flex items-center gap-2 text-sm font-normal cursor-pointer">
          <Checkbox
            checked={showVoided}
            onCheckedChange={(checked) => onToggleShowVoided(checked === true)}
          />
          Show voided
        </Label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <Label>Search</Label>
          <Input
            value={viewSearch}
            onChange={(e) => setViewSearch(e.target.value)}
            placeholder="Search market, metric, round, week"
          />
        </div>
        <div>
          <Label>Round</Label>
          <Select value={viewRoundId} onValueChange={setViewRoundId}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All rounds</SelectItem>
              {rounds.map((round) => (
                <SelectItem key={round.id} value={round.id}>
                  Round {round.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Market</Label>
          <Select value={viewMarketId} onValueChange={setViewMarketId}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All markets</SelectItem>
              {markets.map((market) => (
                <SelectItem key={market.id} value={market.id}>
                  {market.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Metric</Label>
          <Select value={viewMetric} onValueChange={(val) => setViewMetric(val as 'all' | 'OCCUPANCY' | 'ADR')}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All metrics</SelectItem>
              <SelectItem value="OCCUPANCY">Occupancy</SelectItem>
              <SelectItem value="ADR">ADR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              setViewSearch('')
              setViewRoundId('all')
              setViewMarketId('all')
              setViewMetric('all')
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {filteredActuals.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No actuals match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-[400px] overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Round</th>
                  <th className="px-3 py-2 text-left font-medium">Market</th>
                  <th className="px-3 py-2 text-left font-medium">Week</th>
                  <th className="px-3 py-2 text-left font-medium">Metric</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredActuals.map((actual) => (
                  <tr
                    key={actual.id}
                    className={actual.isVoided ? 'bg-red-50 opacity-60' : 'hover:bg-gray-50'}
                  >
                    <td className="px-3 py-2">R{actual.roundNumber}</td>
                    <td className="px-3 py-2">
                      <MarketChip name={actual.marketName} />
                    </td>
                    <td className="px-3 py-2">W+{actual.weekOffset}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        actual.metric === 'OCCUPANCY'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {actual.metric}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {actual.isVoided ? (
                        <span className="line-through">{formatValue(actual.value, actual.metric)}</span>
                      ) : (
                        formatValue(actual.value, actual.metric)
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {actual.isVoided ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onUnvoid(actual)}
                          disabled={actionLoading === actual.id}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(actual)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onVoid(actual)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
            <span>
              Page {page} of {totalPages} &middot; {totalActuals} total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
