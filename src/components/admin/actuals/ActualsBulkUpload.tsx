'use client'

import type { RoundSummary, MarketSummary } from '@/features/actuals/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Download, RefreshCw } from 'lucide-react'

interface ActualsBulkUploadProps {
  rounds: RoundSummary[]
  markets: MarketSummary[]
  bulkData: string
  setBulkData: (v: string) => void
  bulkReason: string
  setBulkReason: (v: string) => void
  bulkSubmitting: boolean
  onSubmit: () => void
  seasonName: string
}

export function ActualsBulkUpload({
  rounds, markets, bulkData, setBulkData,
  bulkReason, setBulkReason, bulkSubmitting,
  onSubmit, seasonName,
}: ActualsBulkUploadProps) {
  const getLockedRoundNumbers = () => {
    return rounds.filter(r => r.isLockedActuals || r.lastScoredAt).map(r => r.number)
  }

  const getBulkDataTargetsLockedRound = () => {
    if (!bulkData.trim()) return false
    const lockedNums = getLockedRoundNumbers()
    const lines = bulkData.trim().split('\n').filter(line => line.trim())
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length >= 1) {
        const roundNum = parseInt(parts[0])
        if (lockedNums.includes(roundNum)) return true
      }
    }
    return false
  }

  const generateTemplate = () => {
    let csv = 'Round,Market,WeekOffset,Occupancy,ADR($)\n'
    rounds.forEach(round => {
      markets.forEach(market => {
        const weekOffsets = round.isFinal ? [1] : [1, 2]
        weekOffsets.forEach(weekOffset => {
          csv += `${round.number},${market.name},${weekOffset},,\n`
        })
      })
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `actuals-template-${seasonName || 'season'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Upload multiple actuals at once using CSV format
        </p>
        <Button variant="outline" size="sm" onClick={generateTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
      </div>

      <div>
        <Label>CSV Data</Label>
        <Textarea
          className="mt-1 font-mono h-48"
          placeholder={"Round,Market,WeekOffset,Occupancy,ADR($)\n1,Nashville CBD,1,72.5,145.00\n1,Nashville CBD,2,74.0,148.50"}
          value={bulkData}
          onChange={(e) => setBulkData(e.target.value)}
        />
      </div>

      {getBulkDataTargetsLockedRound() && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Label className="text-amber-700 text-sm font-medium">
            Reason (required - your data targets locked/scored rounds)
          </Label>
          <Textarea
            className="mt-1 border-amber-200"
            rows={2}
            placeholder="Explain why this bulk upload is needed..."
            value={bulkReason}
            onChange={(e) => setBulkReason(e.target.value)}
          />
        </div>
      )}

      <Button onClick={onSubmit} disabled={bulkSubmitting || !bulkData.trim()} className="w-full">
        {bulkSubmitting ? (
          <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Processing...</>
        ) : (
          <><Upload className="h-4 w-4 mr-2" /> Upload Actuals</>
        )}
      </Button>
    </div>
  )
}
