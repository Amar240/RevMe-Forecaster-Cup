'use client'

import { Button } from '@/components/ui/button'
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

interface ActualUnlockDialogProps {
  roundId: string | null
  unlockReason: string
  setUnlockReason: (v: string) => void
  actionLoading: string | null
  onUnlock: () => void
  onClose: () => void
}

export function ActualUnlockDialog({
  roundId, unlockReason, setUnlockReason,
  actionLoading, onUnlock, onClose,
}: ActualUnlockDialogProps) {
  return (
    <Dialog open={!!roundId} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock Round Actuals</DialogTitle>
          <DialogDescription>
            This round has been scored. Unlocking allows edits but may affect leaderboard integrity.
            A reason is required for audit purposes.
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label>Reason for unlocking</Label>
          <Textarea
            className="mt-1"
            rows={3}
            placeholder="Explain why this unlock is necessary..."
            value={unlockReason}
            onChange={(e) => setUnlockReason(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onUnlock}
            disabled={actionLoading === roundId || unlockReason.trim().length < 5}
            className="flex-1 bg-warning hover:bg-warning"
          >
            {actionLoading === roundId ? 'Unlocking...' : 'Unlock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
