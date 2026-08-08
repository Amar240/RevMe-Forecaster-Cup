'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface UniversityOption { id: string; name: string }
interface CorrectionTeam {
  id: string
  name: string
  displayId: string
  status: string
  university: { id: string; name: string }
  season: { id: string; name: string; status: string } | null
  members: Array<{ id: string; firstName: string; lastName: string; email: string }>
}
interface CorrectionPreflight {
  fingerprint: string
  sourceUniversity: { id: string; name: string } | null
  targetUniversity: { id: string; name: string; country: string | null }
  affectedTeams: CorrectionTeam[]
  affectedStudents: Array<{ id: string; firstName: string; lastName: string; email: string }>
  studentConflicts: Array<{
    student: { id: string; firstName: string; lastName: string; email: string }
    outsideTeams: Array<{ id: string; name: string; displayId: string; university: { name: string } }>
  }>
  impacts: {
    publishedLeaderboardRounds: number
    completedSeasons: Array<{ id: string; name: string }>
    supervisorNotifications: number
    participantNotifications: number
  }
}

function groupTeamsBySeason(teams: CorrectionTeam[]) {
  return teams.reduce<Record<string, CorrectionTeam[]>>((groups, team) => {
    const key = team.season?.name ?? 'Legacy teams'
    groups[key] = [...(groups[key] ?? []), team]
    return groups
  }, {})
}

export function SupervisorAffiliationCorrectionDialog({
  open,
  supervisor,
  universities,
  onOpenChange,
  onCompleted,
}: {
  open: boolean
  supervisor: { id: string; firstName: string; lastName: string; universityId: string | null } | null
  universities: UniversityOption[]
  onOpenChange: (open: boolean) => void
  onCompleted: () => Promise<void> | void
}) {
  const [targetUniversityId, setTargetUniversityId] = useState('')
  const [preflight, setPreflight] = useState<CorrectionPreflight | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (!open) {
      setTargetUniversityId('')
      setPreflight(null)
      setReason('')
      setConfirmation('')
    }
  }, [open])

  useEffect(() => {
    if (!open || !supervisor || !targetUniversityId) return
    const controller = new AbortController()
    setLoading(true)
    setPreflight(null)
    setConfirmation('')
    const search = new URLSearchParams({
      operation: 'CORRECT_AFFILIATION',
      targetUniversityId,
    })
    void csrfFetch(`/api/admin/supervisors/${supervisor.id}/transition?${search}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to prepare correction')
        setPreflight(data as CorrectionPreflight)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error(error instanceof Error ? error.message : 'Failed to prepare correction')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [open, supervisor, targetUniversityId])

  const submit = async () => {
    if (!supervisor || !preflight) return
    setSubmitting(true)
    try {
      const response = await csrfFetch(`/api/admin/supervisors/${supervisor.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'CORRECT_AFFILIATION',
          targetUniversityId,
          typedTargetUniversityName: confirmation,
          reason,
          fingerprint: preflight.fingerprint,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to correct affiliation')
      const failedArchives = (data.archiveResults ?? []).filter((archive: { status: string }) => archive.status === 'FAILED').length
      toast.success(
        failedArchives > 0
          ? 'Affiliation corrected. One or more archive versions need to be retried.'
          : 'University affiliation corrected successfully.'
      )
      onOpenChange(false)
      await onCompleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to correct affiliation')
    } finally {
      setSubmitting(false)
    }
  }

  const conflicts = preflight?.studentConflicts.length ?? 0
  const canSubmit = Boolean(
    preflight &&
    conflicts === 0 &&
    reason.trim().length >= 5 &&
    confirmation === preflight.targetUniversity.name
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" /> Correct university affiliation
          </DialogTitle>
          <DialogDescription>
            Use this only to repair a university selected incorrectly. The supervisor, every team currently assigned to them across all seasons, and eligible students move together.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="correction-university">Correct university</Label>
          <Select value={targetUniversityId} onValueChange={setTargetUniversityId} disabled={submitting}>
            <SelectTrigger id="correction-university"><SelectValue placeholder="Select the correct university" /></SelectTrigger>
            <SelectContent>
              {universities.filter((university) => university.id !== supervisor?.universityId).map((university) => (
                <SelectItem key={university.id} value={university.id}>{university.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-secondary"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Building impact review…</div>
        ) : preflight ? (
          <div className="space-y-5">
            <AlertBanner
              variant={conflicts > 0 ? 'error' : 'warning'}
              title={conflicts > 0 ? `${conflicts} student conflict${conflicts === 1 ? '' : 's'} must be resolved` : 'This correction changes historical attribution'}
            >
              {conflicts > 0
                ? 'No records will change until these students are removed from or resolved on the outside current teams shown below.'
                : 'Forecasts, scores, ranks, identifiers, and advisor assignment history remain unchanged.'}
            </AlertBanner>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-surface-secondary p-3"><p className="text-xs text-text-muted">Teams moving</p><p className="font-mono text-2xl font-semibold">{preflight.affectedTeams.length}</p></div>
              <div className="rounded-lg border border-border bg-surface-secondary p-3"><p className="text-xs text-text-muted">Students updated</p><p className="font-mono text-2xl font-semibold">{preflight.affectedStudents.length}</p></div>
              <div className="rounded-lg border border-border bg-surface-secondary p-3"><p className="text-xs text-text-muted">Published rounds affected</p><p className="font-mono text-2xl font-semibold">{preflight.impacts.publishedLeaderboardRounds}</p></div>
              <div className="rounded-lg border border-border bg-surface-secondary p-3"><p className="text-xs text-text-muted">Archives regenerated</p><p className="font-mono text-2xl font-semibold">{preflight.impacts.completedSeasons.length}</p></div>
            </div>

            {preflight.studentConflicts.map((conflict) => (
              <div key={conflict.student.id} className="rounded-lg border border-error/30 bg-error-background p-4">
                <p className="font-medium text-foreground">{conflict.student.firstName} {conflict.student.lastName}</p>
                <p className="text-sm text-text-secondary">{conflict.student.email}</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-error">
                  {conflict.outsideTeams.map((team) => <li key={team.id}>{team.name} ({team.displayId}) · {team.university.name}</li>)}
                </ul>
              </div>
            ))}

            <section aria-labelledby="affected-teams-title" className="space-y-3">
              <h3 id="affected-teams-title" className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" /> Teams moving to {preflight.targetUniversity.name}</h3>
              {preflight.affectedTeams.length === 0 ? <p className="text-sm text-text-secondary">No teams are currently assigned to this supervisor.</p> : null}
              {Object.entries(groupTeamsBySeason(preflight.affectedTeams)).map(([seasonName, teams]) => (
                <div key={seasonName} className="rounded-lg border border-border bg-surface p-4">
                  <p className="mb-2 text-sm font-semibold text-foreground">{seasonName}</p>
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <div key={team.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>{team.name} <span className="font-mono text-text-muted">{team.displayId}</span></span>
                        <span className="flex items-center gap-2"><Badge variant="neutral">{team.status}</Badge><span className="text-text-muted">{team.members.length} members</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <div className="rounded-lg bg-primary-soft p-4 text-sm text-text-secondary">
              <p className="flex items-center gap-2 font-medium text-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> What stays unchanged</p>
              <p className="mt-1">The supervisor remains the advisor. Submissions, scores, ranks, warnings, team IDs, join requests, tickets, and assignment periods are preserved.</p>
              <p className="mt-2">Notifications: supervisor plus {preflight.impacts.participantNotifications} member{preflight.impacts.participantNotifications === 1 ? '' : 's'} on active teams.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="correction-reason">Reason for correction</Label>
              <Input id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Example: University was selected incorrectly during registration" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="correction-confirmation">Type “{preflight.targetUniversity.name}” to confirm</Label>
              <Input id="correction-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
            </div>
          </div>
        ) : targetUniversityId ? (
          <AlertBanner variant="error" title="Unable to prepare correction">Refresh the supervisor list and try again.</AlertBanner>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-secondary">Select the correct university to review every affected record before anything changes.</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
            Correct affiliation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
