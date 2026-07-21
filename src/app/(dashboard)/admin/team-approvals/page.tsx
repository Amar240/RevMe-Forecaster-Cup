'use client'

import { useEffect, useState } from 'react'
import { Building2, CheckCircle, Clock, Loader2, User, Users, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { approveImportBatch, approveTeam, getPendingTeams, rejectTeam } from '@/features/teams/admin-api'
import type { PendingTeam, PendingTeamsResponse } from '@/features/teams/types'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export default function TeamApprovalsPage() {
  const [data, setData] = useState<PendingTeamsResponse>({ teams: [], groups: [], unbatched: [] })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTeamId, setRejectTeamId] = useState<string | null>(null)
  const [approveBatchId, setApproveBatchId] = useState<string | null>(null)

  const load = async () => {
    try { setData(await getPendingTeams()) }
    catch (error) { clientLogger.error('Failed to load pending teams', error); toast.error('Failed to load pending teams') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const approveOne = async (teamId: string) => {
    setProcessing(teamId)
    try { await approveTeam(teamId); toast.success('Team approved'); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Approval failed') }
    finally { setProcessing(null) }
  }
  const rejectOne = async () => {
    if (!rejectTeamId) return
    setProcessing(rejectTeamId)
    try { await rejectTeam(rejectTeamId, rejectReason); toast.success('Team rejected and supervisor notified'); setRejectTeamId(null); setRejectReason(''); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Rejection failed') }
    finally { setProcessing(null) }
  }
  const approveBatch = async () => {
    if (!approveBatchId) return
    setProcessing(approveBatchId)
    try { await approveImportBatch(approveBatchId); toast.success('Import batch approved'); setApproveBatchId(null); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Batch approval failed') }
    finally { setProcessing(null) }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="font-display text-3xl font-semibold text-foreground">Team Approvals</h1><p className="text-text-secondary">Review imported and individually created teams.</p></div><Badge variant="warning">{data.teams.length} pending</Badge></div>
    {!data.teams.length ? <Card><CardContent className="py-12 text-center"><CheckCircle className="mx-auto mb-3 h-12 w-12 text-success"/><h2 className="font-display text-xl font-semibold">All caught up</h2><p className="text-text-secondary">No teams are awaiting approval.</p></CardContent></Card> : <>
      {data.groups.map((group) => <Card key={group.batch.id} className="border-primary/20"><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{group.teams[0]?.university.name} · {group.batch.fileName}</CardTitle><CardDescription>{group.teams[0]?.supervisor.firstName} {group.teams[0]?.supervisor.lastName} · uploaded {new Date(group.batch.createdAt).toLocaleString()} · {group.teams.length} teams</CardDescription></div><Button onClick={() => setApproveBatchId(group.batch.id)}>Approve all in batch</Button></div></CardHeader><CardContent className="grid gap-4 xl:grid-cols-2">{group.teams.map((team) => <TeamCard key={team.id} team={team} processing={processing} onApprove={approveOne} onReject={setRejectTeamId}/>)}</CardContent></Card>)}
      {data.unbatched.length > 0 && <Card><CardHeader><CardTitle>Individual team requests</CardTitle><CardDescription>Pending teams not associated with a roster import.</CardDescription></CardHeader><CardContent className="grid gap-4 xl:grid-cols-2">{data.unbatched.map((team) => <TeamCard key={team.id} team={team} processing={processing} onApprove={approveOne} onReject={setRejectTeamId}/>)}</CardContent></Card>}
    </>}
    <ConfirmDialog open={Boolean(approveBatchId)} onOpenChange={(open) => !open && setApproveBatchId(null)} title="Approve every pending team in this batch?" description="All teams will become active. Newly provisioned students will receive their activation email once." confirmLabel="Approve batch" loading={processing === approveBatchId} onConfirm={approveBatch}/>
    <ConfirmDialog open={Boolean(rejectTeamId)} onOpenChange={(open) => { if (!open) { setRejectTeamId(null); setRejectReason('') } }} title="Reject this team?" description="The supervisor will be notified with your reason. Students will not receive activation emails." confirmLabel="Reject team" variant="destructive" loading={processing === rejectTeamId} confirmDisabled={!rejectReason.trim()} onConfirm={rejectOne}><Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Required rejection reason" aria-label="Rejection reason"/></ConfirmDialog>
  </div>
}

function TeamCard({ team, processing, onApprove, onReject }: { team: PendingTeam; processing: string | null; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  return <div className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-foreground">{team.name}</h3><p className="font-mono text-xs text-text-muted">{team.displayId}</p></div><Badge variant="warning">Pending</Badge></div><div className="mt-3 space-y-1 text-sm text-text-secondary"><p className="flex items-center gap-2"><Building2 className="h-4 w-4"/>{team.university.name}</p><p className="flex items-center gap-2"><User className="h-4 w-4"/>{team.supervisor.firstName} {team.supervisor.lastName}</p><p className="flex items-center gap-2"><Users className="h-4 w-4"/>{team.members.length} members</p><p className="flex items-center gap-2"><Clock className="h-4 w-4"/>{new Date(team.createdAt).toLocaleDateString()}</p></div><div className="mt-4 flex gap-2"><Button onClick={() => onApprove(team.id)} disabled={processing === team.id}>{processing === team.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <><CheckCircle className="mr-1 h-4 w-4"/>Approve</>}</Button><Button variant="outline" className="text-error" onClick={() => onReject(team.id)}><XCircle className="mr-1 h-4 w-4"/>Reject</Button></div></div>
}
