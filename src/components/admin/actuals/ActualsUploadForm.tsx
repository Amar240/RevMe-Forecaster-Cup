'use client'

import type { RoundSummary, MarketSummary } from '@/features/actuals/types'
import type { SingleEntryFormData } from './actuals-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Check, RefreshCw } from 'lucide-react'

interface ActualsUploadFormProps {
  rounds: RoundSummary[]
  markets: MarketSummary[]
  formData: SingleEntryFormData
  setFormData: (data: SingleEntryFormData) => void
  singleEntryReason: string
  setSingleEntryReason: (v: string) => void
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
  selectedRoundIsLocked: boolean | undefined
}

export function ActualsUploadForm({
  rounds, markets, formData, setFormData,
  singleEntryReason, setSingleEntryReason,
  submitting, onSubmit, selectedRoundIsLocked,
}: ActualsUploadFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Round</Label>
          <Select value={formData.roundId} onValueChange={(val) => setFormData({ ...formData, roundId: val })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select round" /></SelectTrigger>
            <SelectContent>
              {rounds.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  Round {r.number}{r.isFinal ? ' (Final)' : ''}
                  {r.isLockedActuals ? ' (locked)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Market</Label>
          <Select value={formData.marketId} onValueChange={(val) => setFormData({ ...formData, marketId: val })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select market" /></SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Week Offset</Label>
        <Select value={formData.weekOffset} onValueChange={(val) => setFormData({ ...formData, weekOffset: val })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Week +1</SelectItem>
            <SelectItem value="2">Week +2</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Occupancy</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="e.g., 72.5"
            value={formData.occupancy}
            onChange={(e) => setFormData({ ...formData, occupancy: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>ADR ($)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g., 145.00"
            value={formData.adr}
            onChange={(e) => setFormData({ ...formData, adr: e.target.value })}
            required
          />
        </div>
      </div>

      {selectedRoundIsLocked && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <Label className="text-amber-700 text-sm font-medium">
            Reason (required - round is locked/scored)
          </Label>
          <Textarea
            className="mt-1 border-amber-200"
            rows={2}
            placeholder="Explain why this change is needed..."
            value={singleEntryReason}
            onChange={(e) => setSingleEntryReason(e.target.value)}
          />
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700">
        {submitting ? (
          <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</>
        ) : (
          <><Check className="h-4 w-4 mr-2" /> Save Actual</>
        )}
      </Button>
    </form>
  )
}
