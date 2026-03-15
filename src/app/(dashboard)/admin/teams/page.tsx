'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, AlertTriangle, Check, Ban, RefreshCw, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/ui/data-table'
import { CardSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { teamStatusMeta } from '@/lib/status-metadata'

type TeamStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'DISQUALIFIED'

interface Team {
  id: string
  name: string
  displayId: string
  status: TeamStatus
  disqualifiedReason?: string
  university: { name: string }
  supervisor: { firstName: string; lastName: string; email: string }
  members: { user: { firstName: string; lastName: string; email: string }; isSubmitter: boolean }[]
  _count: { submissions: number; warnings: number }
}

const STATUS_CONFIG: Record<TeamStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; icon: React.ElementType }> = {
  DRAFT: { label: teamStatusMeta.DRAFT.label, tone: teamStatusMeta.DRAFT.tone, icon: AlertTriangle },
  PENDING_APPROVAL: { label: 'Pending', tone: teamStatusMeta.PENDING_APPROVAL.tone, icon: AlertTriangle },
  APPROVED: { label: teamStatusMeta.APPROVED.label, tone: teamStatusMeta.APPROVED.tone, icon: Check },
  ACTIVE: { label: teamStatusMeta.ACTIVE.label, tone: teamStatusMeta.ACTIVE.tone, icon: Check },
  REJECTED: { label: teamStatusMeta.REJECTED.label, tone: teamStatusMeta.REJECTED.tone, icon: Ban },
  DISQUALIFIED: { label: teamStatusMeta.DISQUALIFIED.label, tone: teamStatusMeta.DISQUALIFIED.tone, icon: AlertTriangle },
}

export default function AdminTeamsPage() {
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [totalTeams, setTotalTeams] = useState(0)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [showDisqualifyDialog, setShowDisqualifyDialog] = useState(false)
  const [showTeamDetails, setShowTeamDetails] = useState(false)
  const [reinstateTarget, setReinstateTarget] = useState<Team | null>(null)

  const fetchTeams = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/teams')
      if (res.ok) {
        const data = await res.json()
        setTeams(data.teams || [])
        setTotalTeams(data.totalTeams ?? data.teams?.length ?? 0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const handleDisqualify = async () => {
    if (!selectedTeam) return
    setActionLoading(selectedTeam.id)
    try {
      const res = await csrfFetch(`/api/admin/teams/${selectedTeam.id}/disqualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disqualifyReason || 'Admin decision' }),
      })
      const data = await res.json()
      if (res.ok) {
        fetchTeams()
        setShowDisqualifyDialog(false)
        setDisqualifyReason('')
      } else {
        toast.error(data.message || 'Failed to disqualify team')
      }
    } catch (error) {
      clientLogger.error('Disqualify failed:', error)
      toast.error('An error occurred while disqualifying')
    } finally {
      setActionLoading(null)
    }
  }

  const executeReinstate = async (team: Team) => {
    setActionLoading(team.id)
    try {
      const res = await csrfFetch(`/api/admin/teams/${team.id}/reinstate`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        fetchTeams()
      } else {
        toast.error(data.message || 'Failed to reinstate team')
      }
    } catch (error) {
      clientLogger.error('Reinstate failed:', error)
      toast.error('An error occurred while reinstating')
    } finally {
      setActionLoading(null)
      setReinstateTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-full max-w-sm" />
              <Skeleton className="h-10 w-32" />
            </div>
            <TableSkeleton rows={5} columns={7} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeTeams = teams.filter((t) => t.status === 'ACTIVE')
  const pendingTeams = teams.filter((t) => t.status === 'PENDING_APPROVAL' || t.status === 'APPROVED' || t.status === 'DRAFT')
  const disqualifiedTeams = teams.filter((t) => t.status === 'DISQUALIFIED' || t.status === 'REJECTED')

  const columns = [
    {
      key: 'name',
      header: 'Team',
      sortable: true,
      render: (team: Team) => (
        <button
          onClick={() => { setSelectedTeam(team); setShowTeamDetails(true) }}
          className="text-left text-foreground transition-colors hover:text-primary"
        >
          <p className="font-medium">{team.name}</p>
          <p className="text-xs text-text-muted">{team.displayId}</p>
        </button>
      ),
    },
    {
      key: 'university.name',
      header: 'University',
      sortable: true,
      render: (team: Team) => (
        <span className="text-text-secondary">{team.university.name}</span>
      ),
    },
    {
      key: 'supervisor',
      header: 'Supervisor',
      render: (team: Team) => (
        <div>
          <span className="text-text-secondary">
            {team.supervisor.firstName} {team.supervisor.lastName}
          </span>
          <p className="text-xs text-text-muted">{team.supervisor.email}</p>
        </div>
      ),
    },
    {
      key: 'members',
      header: 'Members',
      className: 'text-center',
      render: (team: Team) => <span>{team.members.length}/5</span>,
    },
    {
      key: '_count.submissions',
      header: 'Submissions',
      sortable: true,
      className: 'text-center',
      render: (team: Team) => <span>{team._count.submissions}</span>,
    },
    {
      key: '_count.warnings',
      header: 'Warnings',
      sortable: true,
      className: 'text-center',
      render: (team: Team) => (
        <span className={team._count.warnings >= 2 ? 'font-medium text-warning' : 'text-text-secondary'}>
          {team._count.warnings}/3
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (team: Team) => {
        const config = STATUS_CONFIG[team.status] || STATUS_CONFIG.DRAFT
        const Icon = config.icon
        return (
          <Badge variant={config.tone} className="gap-1 px-2 py-1">
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (team: Team) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={actionLoading === team.id}>
              {actionLoading === team.id ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => { setSelectedTeam(team); setShowTeamDetails(true) }}
            >
              View Details
            </DropdownMenuItem>
            {team.status === 'ACTIVE' ? (
              <DropdownMenuItem
                className="text-error focus:text-error"
                onClick={() => {
                  setSelectedTeam(team)
                  setShowDisqualifyDialog(true)
                }}
              >
                <Ban className="h-4 w-4 mr-2" />
                Disqualify
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-success focus:text-success"
                onClick={() => setReinstateTarget(team)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reinstate
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">All Teams</h1>
        <p className="text-text-secondary">
          {activeTeams.length} active, {pendingTeams.length} pending, {disqualifiedTeams.length} disqualified
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card variant="metric">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalTeams}</p>
          </CardContent>
        </Card>
        <Card variant="metric" className="border-success/20 bg-success-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{activeTeams.length}</p>
          </CardContent>
        </Card>
        <Card variant="metric" className="border-warning/20 bg-warning-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{pendingTeams.length}</p>
          </CardContent>
        </Card>
        <Card variant="metric" className="border-error/20 bg-error-background/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Disqualified</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-error">{disqualifiedTeams.length}</p>
          </CardContent>
        </Card>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-text-muted" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No Teams Yet</h3>
            <p className="text-text-secondary">Teams will appear here once supervisors create them.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Teams</CardTitle>
          </CardHeader>
          <CardContent>
          <DataTable
            data={teams}
              columns={columns}
              searchKeys={['name', 'displayId', 'university.name']}
              searchPlaceholder="Search by team name or university..."
              pageSize={20}
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: 'ACTIVE', label: 'Active' },
                    { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
                    { value: 'APPROVED', label: 'Approved' },
                    { value: 'DRAFT', label: 'Draft' },
                    { value: 'REJECTED', label: 'Rejected' },
                    { value: 'DISQUALIFIED', label: 'Disqualified' },
                  ],
                },
              ]}
          />
        </CardContent>
      </Card>
      )}

      <Dialog open={showDisqualifyDialog} onOpenChange={setShowDisqualifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disqualify Team</DialogTitle>
            <DialogDescription>
              Disqualify &quot;{selectedTeam?.name}&quot;? This will prevent them from participating.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Input
                id="reason"
                value={disqualifyReason}
                onChange={(e) => setDisqualifyReason(e.target.value)}
                placeholder="e.g., Missed 3 submissions"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisqualifyDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisqualify}
              disabled={actionLoading === selectedTeam?.id}
            >
              {actionLoading === selectedTeam?.id ? 'Disqualifying...' : 'Disqualify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTeamDetails} onOpenChange={setShowTeamDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTeam?.name}</DialogTitle>
            <DialogDescription>Team ID: {selectedTeam?.displayId}</DialogDescription>
          </DialogHeader>
          {selectedTeam && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-text-muted">Status</p>
                  <div className="mt-2">
                    <Badge variant={STATUS_CONFIG[selectedTeam.status].tone}>
                      {STATUS_CONFIG[selectedTeam.status].label}
                    </Badge>
                  </div>
                  {selectedTeam.disqualifiedReason && (
                    <p className="mt-2 text-xs text-text-muted">{selectedTeam.disqualifiedReason}</p>
                  )}
                </div>
                <div>
                  <p className="text-text-muted">University</p>
                  <p className="font-medium">{selectedTeam.university.name}</p>
                </div>
                <div>
                  <p className="text-text-muted">Submissions</p>
                  <p className="font-medium">{selectedTeam._count.submissions}</p>
                </div>
                <div>
                  <p className="text-text-muted">Warnings</p>
                  <p className={`font-medium ${selectedTeam._count.warnings >= 2 ? 'text-warning' : 'text-foreground'}`}>
                    {selectedTeam._count.warnings}/3
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm text-text-muted">Supervisor</p>
                <div className="rounded-lg border border-border bg-surface-secondary p-3">
                  <p className="font-medium">
                    {selectedTeam.supervisor.firstName} {selectedTeam.supervisor.lastName}
                  </p>
                  <p className="text-sm text-text-muted">{selectedTeam.supervisor.email}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm text-text-muted">Members ({selectedTeam.members.length}/5)</p>
                <div className="space-y-2">
                  {selectedTeam.members.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary p-3">
                      <div>
                        <p className="font-medium">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-sm text-text-muted">{member.user.email}</p>
                      </div>
                      {member.isSubmitter && (
                        <Badge variant="info">
                          Submitter
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={reinstateTarget !== null}
        onOpenChange={(open) => { if (!open) setReinstateTarget(null) }}
        title="Reinstate Team"
        description={`Reinstate team "${reinstateTarget?.name}"? They will be able to participate again.`}
        confirmLabel="Reinstate"
        loading={actionLoading === reinstateTarget?.id}
        onConfirm={() => { if (reinstateTarget) executeReinstate(reinstateTarget) }}
      />
    </div>
  )
}
