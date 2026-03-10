'use client'

import type { RoundSummary, ActualSummary, ActualRevision } from '@/features/actuals/types'
import { MarketChip, formatDate } from './actuals-types'
import { Button } from '@/components/ui/button'
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
          <div className="text-sm text-gray-600">
            <div className="flex gap-2 mb-2">
              <MarketChip name={actual.marketName} />
              <span className="px-2 py-0.5 rounded bg-gray-100">Round {actual.roundNumber}</span>
              <span className="px-2 py-0.5 rounded bg-gray-100">W+{actual.weekOffset}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs ${
              actual.metric === 'OCCUPANCY'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {actual.metric}
            </span>
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
              <Label className="text-amber-600">Reason (required for locked/scored round)</Label>
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
                  <div key={rev.id} className="text-xs p-2 bg-gray-50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`px-1.5 py-0.5 rounded ${
                        rev.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                        rev.action === 'EDIT' ? 'bg-blue-100 text-blue-700' :
                        rev.action === 'VOID' ? 'bg-red-100 text-red-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {rev.action}
                      </span>
                      <span className="text-gray-500">{formatDate(rev.createdAt)}</span>
                    </div>
                    <div className="text-gray-600">
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
                    <div className="text-gray-500 mt-1">by {rev.actor}</div>
                    {rev.reason && (
                      <div className="text-gray-600 mt-1 italic">&quot;{rev.reason}&quot;</div>
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
