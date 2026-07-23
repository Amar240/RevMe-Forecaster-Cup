'use client'

import type { RoundSummary, ActualSummary, ActualRevision } from '@/features/actuals/types'
import { MarketChip, formatDate } from './actuals-types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { RefreshCw } from 'lucide-react'
import { actualMetricMeta } from '@/lib/status-metadata'

interface ActualEditDialogProps {
  actual: ActualSummary | null
  editValue: string
  setEditValue: (v: string) => void
  editReason: string
  setEditReason: (v: string) => void
  editRevisions: ActualRevision[]
  rounds: RoundSummary[]
  actionLoading: string | null
  onSave: () => void
  onClose: () => void
}

export function ActualEditDialog({
  actual, editValue, setEditValue,
  editReason, setEditReason, editRevisions,
  rounds, actionLoading, onSave, onClose,
}: ActualEditDialogProps) {
  if (!actual) return null

  const round = rounds.find(r => r.id === actual.roundId)
  const requiresReason = round?.isLockedActuals || round?.lastScoredAt

  return (
    <Dialog open={!!actual} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Actual</DialogTitle>
          <DialogDescription>
            Update the value for this actual entry
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-text-secondary">
            <div className="flex gap-2 mb-2">
              <MarketChip name={actual.marketName} />
              <Badge variant="neutral">Round {actual.roundNumber}</Badge>
              <Badge variant="neutral">W+{actual.weekOffset}</Badge>
            </div>
            <Badge variant={actualMetricMeta[actual.metric].tone}>
              {actual.metric}
            </Badge>
          </div>

          <div>
            <Label>{actual.metric === 'OCCUPANCY' ? 'Occupancy' : 'ADR ($)'}</Label>
            <Input
              type="number"
              step={actual.metric === 'OCCUPANCY' ? '0.1' : '0.01'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
            />
          </div>

          {requiresReason && (
            <div>
              <Label className="text-warning">Reason (required for locked/scored round)</Label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="Explain why this change is needed..."
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={onSave}
            disabled={actionLoading === actual.id}
            className="w-full"
          >
            {actionLoading === actual.id ? (
              <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</>
            ) : (
              'Save Changes'
            )}
          </Button>

          {editRevisions.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="font-medium text-sm mb-2">Audit History</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {editRevisions.map((rev) => (
                  <div key={rev.id} className="rounded-lg border border-border bg-surface-secondary p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <Badge
                        variant={
                          rev.action === 'CREATE' ? 'success' :
                          rev.action === 'EDIT' ? 'info' :
                          rev.action === 'VOID' ? 'error' :
                          'medal'
                        }
                        className="px-1.5 py-0.5"
                      >
                        {rev.action}
                      </Badge>
                      <span className="text-text-muted">{formatDate(rev.createdAt)}</span>
                    </div>
                    <div className="text-text-secondary">
                      {rev.oldValue !== null && rev.newValue !== null && (
                        <span>{rev.oldValue} {'->'} {rev.newValue}</span>
                      )}
                      {rev.oldValue === null && rev.newValue !== null && (
                        <span>Created: {rev.newValue}</span>
                      )}
                      {rev.oldValue !== null && rev.newValue === null && (
                        <span>Voided from: {rev.oldValue}</span>
                      )}
                    </div>
                    <div className="mt-1 text-text-muted">by {rev.actor}</div>
                    {rev.reason && (
                      <div className="mt-1 italic text-text-secondary">&quot;{rev.reason}&quot;</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
