'use client'

import type { RoundSummary, ActualSummary } from '@/features/actuals/types'
import { MarketChip, formatValue } from './actuals-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

interface ActualVoidDialogProps {
  actual: ActualSummary | null
  voidReason: string
  setVoidReason: (v: string) => void
  rounds: RoundSummary[]
  actionLoading: string | null
  onVoid: () => void
  onClose: () => void
}

export function ActualVoidDialog({
  actual, voidReason, setVoidReason,
  rounds, actionLoading, onVoid, onClose,
}: ActualVoidDialogProps) {
  if (!actual) return null

  const round = rounds.find(r => r.id === actual.roundId)
  const requiresReason = round?.isLockedActuals || round?.lastScoredAt

  return (
    <Dialog open={!!actual} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void Actual</DialogTitle>
          <DialogDescription>
            This will soft-delete the actual value. It can be restored later if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-surface-secondary p-3 text-sm">
          <div className="flex gap-2 mb-1">
            <MarketChip name={actual.marketName} />
            <Badge variant={actual.metric === 'OCCUPANCY' ? 'info' : 'medal'}>{actual.metric}</Badge>
          </div>
          <div className="font-medium">
            Round {actual.roundNumber}, W+{actual.weekOffset}: {formatValue(actual.value, actual.metric)}
          </div>
        </div>

        {requiresReason && (
          <div>
            <Label className="text-warning">Reason (required)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="Explain why this void is necessary..."
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onVoid}
            disabled={actionLoading === actual.id}
            className="flex-1"
          >
            {actionLoading === actual.id ? 'Voiding...' : 'Void Actual'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
