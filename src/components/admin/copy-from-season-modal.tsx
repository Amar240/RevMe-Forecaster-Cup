'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface CompletedSeason {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  teamCount: number
}

interface CopyResult {
  sourceSeasonName: string
  targetSeasonName: string
  teamsCreated: number
  teamsSkipped: number
  membersLinked: number
}

interface CopyFromSeasonModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The season that teams will be copied INTO */
  targetSeasonId: string
  targetSeasonName: string
  onSuccess?: (result: CopyResult) => void
}

type ModalState = 'loading' | 'ready' | 'copying' | 'done' | 'error'

export function CopyFromSeasonModal({
  open,
  onOpenChange,
  targetSeasonId,
  targetSeasonName,
  onSuccess,
}: CopyFromSeasonModalProps) {
  const [state, setState] = useState<ModalState>('loading')
  const [seasons, setSeasons] = useState<CompletedSeason[]>([])
  const [result, setResult] = useState<CopyResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchSeasons = useCallback(async () => {
    setState('loading')
    setErrorMessage('')
    try {
      const res = await csrfFetch('/api/admin/teams/copy-from-season')
      const data = await res.json() as { seasons: CompletedSeason[] }
      if (!res.ok) throw new Error((data as { message?: string }).message || 'Failed to load seasons')
      setSeasons(data.seasons ?? [])
      setState(data.seasons?.length > 0 ? 'ready' : 'error')
      if (!data.seasons?.length) {
        setErrorMessage('No completed seasons with active teams were found.')
      }
    } catch (error) {
      clientLogger.error('Failed to load copy-from-season options:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load seasons')
      setState('error')
    }
  }, [])

  // Reload options every time the modal opens
  useEffect(() => {
    if (open) {
      setResult(null)
      void fetchSeasons()
    }
  }, [open, fetchSeasons])

  const selectedSeason = seasons[0] ?? null

  const handleCopy = async () => {
    if (!selectedSeason) {
      toast.error('No completed season is available to copy from')
      return
    }

    setState('copying')
    setErrorMessage('')

    try {
      const res = await csrfFetch('/api/admin/teams/copy-from-season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceSeasonId: selectedSeason.id,
          targetSeasonId,
          copyMembers: false,
        }),
      })
      const data = await res.json() as CopyResult & { message?: string }
      if (!res.ok) throw new Error(data.message || 'Copy failed')

      setResult(data)
      setState('done')
      toast.success(`Copied ${data.teamsCreated} team${data.teamsCreated === 1 ? '' : 's'} into ${targetSeasonName}`)
      onSuccess?.(data)
    } catch (error) {
      clientLogger.error('Failed to copy teams from season:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Copy failed')
      setState('ready')
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Copy Teams from Previous Season
          </DialogTitle>
          <DialogDescription>
            Copy team rosters into <strong>{targetSeasonName}</strong>. Submissions, scores, and warnings
            are never copied — they belong to the original season.
          </DialogDescription>
        </DialogHeader>

        {/* ── Loading ── */}
        {state === 'loading' && (
          <div className="flex items-center justify-center py-8 text-text-secondary">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading completed seasons…
          </div>
        )}

        {/* ── Error (no seasons found) ── */}
        {state === 'error' && (
          <div className="flex items-start gap-3 rounded-xl border border-error/20 bg-error-background px-4 py-3 text-sm text-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ── Source summary ── */}
        {(state === 'ready' || state === 'copying') && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Source season</Label>
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
                {selectedSeason ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{selectedSeason.name}</span>
                      <Badge variant="secondary" className="shrink-0">
                        <Users className="mr-1 h-3 w-3" />
                        {selectedSeason.teamCount} {selectedSeason.teamCount === 1 ? 'team' : 'teams'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">Most recent completed season</p>
                  </>
                ) : (
                  <p className="text-text-muted">No completed season is available to copy from.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Target season</Label>
              <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
                <span className="font-medium text-foreground">{targetSeasonName}</span>
              </div>
            </div>

            {/* Members checkbox */}
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-secondary px-4 py-3">
              <Checkbox
                id="copy-members"
                checked={false}
                disabled
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="copy-members" className="font-medium">
                  Also copy team members
                </Label>
                <p className="text-xs text-text-muted">
                  Member carry-over is unavailable in this first safe version. Teams only will be copied,
                  and members can be added manually later.
                </p>
              </div>
            </div>

            {/* What will be copied summary */}
            {selectedSeason && (
              <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm text-text-secondary">
                <p>
                  This will create{' '}
                  <strong className="text-foreground">
                    {selectedSeason.teamCount} {selectedSeason.teamCount === 1 ? 'team' : 'teams'}
                  </strong>{' '}
                  in <strong className="text-foreground">{targetSeasonName}</strong> from{' '}
                  <strong className="text-foreground">{selectedSeason.name}</strong>.
                </p>
                <p className="mt-1">
                  Each team keeps its name, university, supervisor, and external ID. Members will not be
                  copied in this first safe version.
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Teams with an external ID that already exists in {targetSeasonName} will be skipped.
                </p>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-error/20 bg-error-background px-4 py-3 text-sm text-error">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* ── Done ── */}
        {state === 'done' && result && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-success/20 bg-success-background/60 px-4 py-3 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Copy complete</p>
                <p className="mt-0.5 text-success/80">
                  {result.teamsCreated} {result.teamsCreated === 1 ? 'team' : 'teams'} added to{' '}
                  {result.targetSeasonName}
                  {result.teamsSkipped > 0 ? `, ${result.teamsSkipped} skipped` : ''}
                  {result.membersLinked > 0 ? `, ${result.membersLinked} member links created` : ''}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-surface-secondary px-3 py-3 text-center">
                <p className="text-2xl font-bold text-success">{result.teamsCreated}</p>
                <p className="mt-0.5 text-xs text-text-muted">Created</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-secondary px-3 py-3 text-center">
                <p className="text-2xl font-bold text-warning">{result.teamsSkipped}</p>
                <p className="mt-0.5 text-xs text-text-muted">Skipped</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-secondary px-3 py-3 text-center">
                <p className="text-2xl font-bold">{result.membersLinked}</p>
                <p className="mt-0.5 text-xs text-text-muted">Members</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {state === 'done' ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={state === 'copying'}>
                Cancel
              </Button>
              <Button
                onClick={handleCopy}
                disabled={state !== 'ready' || !selectedSeason}
              >
                {state === 'copying' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Copying…
                  </>
                ) : selectedSeason ? (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Import {selectedSeason.teamCount} team{selectedSeason.teamCount === 1 ? '' : 's'} into{' '}
                    {targetSeasonName}
                  </>
                ) : (
                  'Import Teams'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
