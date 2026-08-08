'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Loader2, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

type Operation = 'CHANGE_UNIVERSITY' | 'DEACTIVATE'

interface SupervisorOption {
  id: string
  firstName: string
  lastName: string
  email: string
  currentTeamCount?: number
  remainingCapacity?: number
}

interface TransitionTeam {
  id: string
  name: string
  displayId: string
  status: string
  university: { id: string; name: string }
  season: { id: string; name: string; status: string } | null
  _count: { members: number }
  eligibleSupervisors: SupervisorOption[]
}

interface TransitionRequest {
  id: string
  student: { firstName: string; lastName: string; email: string }
}

interface TransitionTicket {
  id: string
  subject: string
  createdBy: { firstName: string; lastName: string; email: string }
}

interface Preflight {
  fingerprint: string
  currentTeams: TransitionTeam[]
  historicalTeams: Array<{ id: string; name: string; displayId: string; status: string }>
  unrelatedRequests: TransitionRequest[]
  unrelatedTickets: TransitionTicket[]
  eligibleUniversitySupervisors: SupervisorOption[]
  automaticallyFollowing: { joinRequests: number; supportTickets: number }
}

interface SupervisorTransitionDialogProps {
  open: boolean
  supervisor: {
    id: string
    firstName: string
    lastName: string
    universityId: string | null
    university: { id: string; name: string } | null
  } | null
  universities: Array<{ id: string; name: string }>
  operation: Operation
  onOpenChange: (open: boolean) => void
  onCompleted: () => Promise<void> | void
}

type Resolution = { action: string; supervisorId: string }

function personLabel(person: SupervisorOption) {
  const capacity = person.remainingCapacity == null ? '' : ` · ${person.remainingCapacity} spots left`
  return `${person.firstName} ${person.lastName} (${person.email})${capacity}`
}

export function SupervisorTransitionDialog({
  open,
  supervisor,
  universities,
  operation,
  onOpenChange,
  onCompleted,
}: SupervisorTransitionDialogProps) {
  const [targetUniversityId, setTargetUniversityId] = useState('')
  const [preflight, setPreflight] = useState<Preflight | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reason, setReason] = useState('')
  const [teamResolutions, setTeamResolutions] = useState<Record<string, Resolution>>({})
  const [requestResolutions, setRequestResolutions] = useState<Record<string, Resolution>>({})
  const [ticketResolutions, setTicketResolutions] = useState<Record<string, Resolution>>({})

  const canLoad = Boolean(
    supervisor && (operation === 'DEACTIVATE' || targetUniversityId)
  )

  useEffect(() => {
    if (!open) {
      setTargetUniversityId('')
      setPreflight(null)
      setReason('')
      setTeamResolutions({})
      setRequestResolutions({})
      setTicketResolutions({})
    }
  }, [open])

  useEffect(() => {
    if (!open || !supervisor || !canLoad) return
    const controller = new AbortController()
    setLoading(true)
    setPreflight(null)
    const search = new URLSearchParams({ operation })
    if (operation === 'CHANGE_UNIVERSITY') search.set('targetUniversityId', targetUniversityId)

    void csrfFetch(`/api/admin/supervisors/${supervisor.id}/transition?${search.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Failed to prepare transition')
        const next = data as Preflight
        setPreflight(next)
        setTeamResolutions(Object.fromEntries(next.currentTeams.map((team) => [team.id, { action: 'UNASSIGN', supervisorId: '' }])))
        setRequestResolutions(Object.fromEntries(next.unrelatedRequests.map((request) => [request.id, { action: 'CANCEL', supervisorId: '' }])))
        setTicketResolutions(Object.fromEntries(next.unrelatedTickets.map((ticket) => [ticket.id, { action: 'ESCALATE', supervisorId: '' }])))
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error(error instanceof Error ? error.message : 'Failed to prepare transition')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [canLoad, open, operation, supervisor, targetUniversityId])

  const missingResolution = useMemo(() => {
    if (!preflight) return true
    return [
      ...preflight.currentTeams.map((team) => teamResolutions[team.id]),
      ...preflight.unrelatedRequests.map((request) => requestResolutions[request.id]),
      ...preflight.unrelatedTickets.map((ticket) => ticketResolutions[ticket.id]),
    ].some((resolution) => !resolution || (resolution.action === 'REASSIGN' && !resolution.supervisorId))
  }, [preflight, requestResolutions, teamResolutions, ticketResolutions])

  const submit = async () => {
    if (!supervisor || !preflight || missingResolution) return
    setSubmitting(true)
    try {
      const response = await csrfFetch(`/api/admin/supervisors/${supervisor.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          targetUniversityId: operation === 'CHANGE_UNIVERSITY' ? targetUniversityId : null,
          reason,
          fingerprint: preflight.fingerprint,
          teamResolutions: preflight.currentTeams.map((team) => ({
            teamId: team.id,
            action: teamResolutions[team.id].action,
            supervisorId: teamResolutions[team.id].supervisorId || null,
          })),
          joinRequestResolutions: preflight.unrelatedRequests.map((request) => ({
            joinRequestId: request.id,
            action: requestResolutions[request.id].action,
            supervisorId: requestResolutions[request.id].supervisorId || null,
          })),
          ticketResolutions: preflight.unrelatedTickets.map((ticket) => ({
            ticketId: ticket.id,
            action: ticketResolutions[ticket.id].action,
            supervisorId: ticketResolutions[ticket.id].supervisorId || null,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to complete transition')
      toast.success(operation === 'CHANGE_UNIVERSITY' ? 'Supervisor university changed' : 'Supervisor deactivated')
      onOpenChange(false)
      await onCompleted()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete transition')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {operation === 'CHANGE_UNIVERSITY' ? <ArrowRightLeft className="h-5 w-5" /> : <UserMinus className="h-5 w-5" />}
            {operation === 'CHANGE_UNIVERSITY' ? 'Change supervisor university' : 'Deactivate supervisor'}
          </DialogTitle>
          <DialogDescription>
            Resolve every current responsibility for {supervisor?.firstName} {supervisor?.lastName}. Historical teams remain unchanged.
          </DialogDescription>
        </DialogHeader>

        {operation === 'CHANGE_UNIVERSITY' ? (
          <div className="space-y-2">
            <Label htmlFor="transition-university">New university</Label>
            <Select value={targetUniversityId} onValueChange={setTargetUniversityId} disabled={submitting}>
              <SelectTrigger id="transition-university"><SelectValue placeholder="Select the new university" /></SelectTrigger>
              <SelectContent>
                {universities.filter((university) => university.id !== supervisor?.universityId).map((university) => (
                  <SelectItem key={university.id} value={university.id}>{university.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-secondary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking current responsibilities...
          </div>
        ) : preflight ? (
          <div className="space-y-5">
            <AlertBanner
              variant="warning"
              title={`${preflight.currentTeams.length} current team${preflight.currentTeams.length === 1 ? '' : 's'} require a decision`}
            >
              Reassign each team to an eligible advisor or leave it temporarily unassigned. Students can continue submitting while unassigned.
            </AlertBanner>

            <section className="space-y-3" aria-labelledby="transition-teams-title">
              <h3 id="transition-teams-title" className="font-semibold text-foreground">Current teams</h3>
              {preflight.currentTeams.length === 0 ? <p className="text-sm text-text-secondary">No current teams require action.</p> : null}
              {preflight.currentTeams.map((team) => {
                const resolution = teamResolutions[team.id]
                return (
                  <div key={team.id} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">{team.name}</p>
                        <p className="text-xs text-text-muted">{team.displayId} · {team.university.name} · {team.season?.name ?? 'Legacy team'} · {team._count.members} members</p>
                      </div>
                      <Badge variant="warning">{team.status}</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Select
                        value={resolution?.action ?? 'UNASSIGN'}
                        onValueChange={(action) => setTeamResolutions((current) => ({ ...current, [team.id]: { action, supervisorId: '' } }))}
                      >
                        <SelectTrigger aria-label={`Resolution for ${team.name}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNASSIGN">Temporarily unassign</SelectItem>
                          <SelectItem value="REASSIGN" disabled={team.eligibleSupervisors.length === 0}>Reassign supervisor</SelectItem>
                        </SelectContent>
                      </Select>
                      {resolution?.action === 'REASSIGN' ? (
                        <Select
                          value={resolution.supervisorId}
                          onValueChange={(supervisorId) => setTeamResolutions((current) => ({ ...current, [team.id]: { action: 'REASSIGN', supervisorId } }))}
                        >
                          <SelectTrigger aria-label={`Replacement supervisor for ${team.name}`}><SelectValue placeholder="Choose replacement" /></SelectTrigger>
                          <SelectContent>{team.eligibleSupervisors.map((person) => <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </section>

            {(preflight.unrelatedRequests.length > 0 || preflight.unrelatedTickets.length > 0) ? (
              <section className="space-y-3" aria-labelledby="dependent-work-title">
                <h3 id="dependent-work-title" className="font-semibold text-foreground">Other pending work</h3>
                {preflight.unrelatedRequests.map((request) => {
                  const resolution = requestResolutions[request.id]
                  return (
                    <div key={request.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">Join request · {request.student.firstName} {request.student.lastName}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Select value={resolution?.action ?? 'CANCEL'} onValueChange={(action) => setRequestResolutions((current) => ({ ...current, [request.id]: { action, supervisorId: '' } }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="CANCEL">Cancel with notice</SelectItem><SelectItem value="REASSIGN">Reassign</SelectItem></SelectContent>
                        </Select>
                        {resolution?.action === 'REASSIGN' ? <Select value={resolution.supervisorId} onValueChange={(supervisorId) => setRequestResolutions((current) => ({ ...current, [request.id]: { action: 'REASSIGN', supervisorId } }))}><SelectTrigger><SelectValue placeholder="Choose replacement" /></SelectTrigger><SelectContent>{preflight.eligibleUniversitySupervisors.map((person) => <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>)}</SelectContent></Select> : null}
                      </div>
                    </div>
                  )
                })}
                {preflight.unrelatedTickets.map((ticket) => {
                  const resolution = ticketResolutions[ticket.id]
                  return (
                    <div key={ticket.id} className="rounded-lg border border-border p-3">
                      <p className="text-sm font-medium text-foreground">Support ticket · {ticket.subject}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <Select value={resolution?.action ?? 'ESCALATE'} onValueChange={(action) => setTicketResolutions((current) => ({ ...current, [ticket.id]: { action, supervisorId: '' } }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="ESCALATE">Escalate to admins</SelectItem><SelectItem value="REASSIGN">Reassign</SelectItem></SelectContent>
                        </Select>
                        {resolution?.action === 'REASSIGN' ? <Select value={resolution.supervisorId} onValueChange={(supervisorId) => setTicketResolutions((current) => ({ ...current, [ticket.id]: { action: 'REASSIGN', supervisorId } }))}><SelectTrigger><SelectValue placeholder="Choose replacement" /></SelectTrigger><SelectContent>{preflight.eligibleUniversitySupervisors.map((person) => <SelectItem key={person.id} value={person.id}>{personLabel(person)}</SelectItem>)}</SelectContent></Select> : null}
                      </div>
                    </div>
                  )
                })}
              </section>
            ) : null}

            <div className="rounded-lg bg-surface-secondary p-4 text-sm text-text-secondary">
              <p><strong className="text-foreground">Historical teams:</strong> {preflight.historicalTeams.length} retained for reporting.</p>
              <p><strong className="text-foreground">Automatic routing:</strong> {preflight.automaticallyFollowing.joinRequests} team join requests and {preflight.automaticallyFollowing.supportTickets} team tickets follow their reassigned team.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transition-reason">Reason for this change</Label>
              <Input id="transition-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Example: Advisor moved to another university" />
              <p className="text-xs text-text-muted">Required for the audit record (5–500 characters).</p>
            </div>
          </div>
        ) : canLoad ? (
          <AlertBanner variant="error" title="Unable to prepare transition">Close this dialog, refresh the supervisor list, and try again.</AlertBanner>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-secondary">Select the destination university to review the transition.</div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            variant={operation === 'DEACTIVATE' ? 'destructive' : 'default'}
            onClick={() => void submit()}
            disabled={!preflight || missingResolution || reason.trim().length < 5 || submitting}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
            {operation === 'CHANGE_UNIVERSITY' ? 'Apply transition' : 'Resolve and deactivate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
