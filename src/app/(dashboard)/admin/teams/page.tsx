'use client'

import Link from 'next/link'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Users, AlertTriangle, Check, Ban, RefreshCw, MoreVertical, Loader2, Settings, FileSpreadsheet, Upload, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/ui/data-table'
import { CardSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { teamStatusMeta } from '@/lib/status-metadata'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/ui/access-denied'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type TeamStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'DISQUALIFIED' | 'ARCHIVED'

interface Team {
  id: string
  name: string
  displayId: string
  status: TeamStatus
  disqualifiedReason?: string
  university: { name: string }
  supervisor: { firstName: string; lastName: string; email: string } | null
  members: { user: { firstName: string; lastName: string; email: string }; isSubmitter: boolean }[]
  _count: { submissions: number; warnings: number }
}

interface TeamSummaryCounts {
  activeTeams: number
  pendingTeams: number
  disqualifiedTeams: number
}

interface ResolvedSeason {
  id: string
  name: string
  status: string
}

interface SeasonOption {
  id: string
  name: string
  status: string
}

interface UniversityOption {
  id: string
  name: string
}

interface SupervisorOption {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  universityId: string | null
  _count: { supervisedTeams: number }
}

const STATUS_CONFIG: Record<TeamStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'error'; icon: React.ElementType }> = {
  DRAFT: { label: teamStatusMeta.DRAFT.label, tone: teamStatusMeta.DRAFT.tone, icon: AlertTriangle },
  PENDING_APPROVAL: { label: 'Pending', tone: teamStatusMeta.PENDING_APPROVAL.tone, icon: AlertTriangle },
  APPROVED: { label: teamStatusMeta.APPROVED.label, tone: teamStatusMeta.APPROVED.tone, icon: Check },
  ACTIVE: { label: teamStatusMeta.ACTIVE.label, tone: teamStatusMeta.ACTIVE.tone, icon: Check },
  REJECTED: { label: teamStatusMeta.REJECTED.label, tone: teamStatusMeta.REJECTED.tone, icon: Ban },
  DISQUALIFIED: { label: teamStatusMeta.DISQUALIFIED.label, tone: teamStatusMeta.DISQUALIFIED.tone, icon: AlertTriangle },
  ARCHIVED: { label: teamStatusMeta.ARCHIVED.label, tone: teamStatusMeta.ARCHIVED.tone, icon: Ban },
}

export default function AdminTeamsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { loading: permLoading, isAdmin, hasFullAccess } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [totalTeams, setTotalTeams] = useState(0)
  const [summary, setSummary] = useState<TeamSummaryCounts>({
    activeTeams: 0,
    pendingTeams: 0,
    disqualifiedTeams: 0,
  })
  const [resolvedSeason, setResolvedSeason] = useState<ResolvedSeason | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [showDisqualifyDialog, setShowDisqualifyDialog] = useState(false)
  const [reinstateTarget, setReinstateTarget] = useState<Team | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loadingCreateOptions, setLoadingCreateOptions] = useState(false)
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [seasons, setSeasons] = useState<SeasonOption[]>([])
  const [universities, setUniversities] = useState<UniversityOption[]>([])
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([])
  const [teamForm, setTeamForm] = useState({
    seasonId: '',
    universityId: '',
    name: '',
    externalTeamId: '',
    supervisorId: '',
  })
  const hasRosterAccess = isAdmin || hasFullAccess

  const fetchTeams = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/teams')
      if (res.ok) {
        const data = await res.json()
        setTeams(data.teams || [])
        setTotalTeams(data.totalTeams ?? data.teams?.length ?? 0)
        setSummary({
          activeTeams: data.summary?.activeTeams ?? 0,
          pendingTeams: data.summary?.pendingTeams ?? 0,
          disqualifiedTeams: data.summary?.disqualifiedTeams ?? 0,
        })
        setResolvedSeason(data.season ?? null)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && hasRosterAccess) {
      void fetchTeams()
    }
  }, [fetchTeams, hasRosterAccess, permLoading])

  const resetCreateForm = useCallback(() => {
    setTeamForm({
      seasonId: seasons[0]?.id ?? '',
      universityId: '',
      name: '',
      externalTeamId: '',
      supervisorId: '',
    })
  }, [seasons])

  const loadCreateOptions = useCallback(async () => {
    setLoadingCreateOptions(true)
    try {
      const [seasonRes, universityRes, supervisorRes] = await Promise.all([
        csrfFetch('/api/admin/teams/import/options'),
        csrfFetch('/api/admin/universities'),
        csrfFetch('/api/admin/supervisors'),
      ])

      const [seasonData, universityData, supervisorData] = await Promise.all([
        seasonRes.json(),
        universityRes.json(),
        supervisorRes.json(),
      ])

      if (!seasonRes.ok) throw new Error(seasonData.message || 'Failed to load seasons')
      if (!universityRes.ok) throw new Error(universityData.message || 'Failed to load universities')
      if (!supervisorRes.ok) throw new Error(supervisorData.message || 'Failed to load supervisors')

      const nextSeasons = seasonData.seasons || []
      setSeasons(nextSeasons)
      setUniversities(universityData.universities || [])
      setSupervisors(supervisorData.supervisors || [])
      setTeamForm({
        seasonId: nextSeasons[0]?.id ?? '',
        universityId: '',
        name: '',
        externalTeamId: '',
        supervisorId: '',
      })
    } catch (error) {
      clientLogger.error('Failed to load create-team options:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load team creation options')
      setShowCreateDialog(false)
    } finally {
      setLoadingCreateOptions(false)
    }
  }, [])

  const openCreateDialog = async () => {
    setShowCreateDialog(true)
    await loadCreateOptions()
  }

  const handleCreateTeam = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!teamForm.seasonId || !teamForm.universityId || !teamForm.name.trim() || !teamForm.supervisorId) {
      toast.error('Season, university, team name, and supervisor are required')
      return
    }

    setCreatingTeam(true)
    try {
      const res = await csrfFetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: teamForm.seasonId,
          universityId: teamForm.universityId,
          name: teamForm.name.trim(),
          externalTeamId: teamForm.externalTeamId.trim() || null,
          supervisorId: teamForm.supervisorId,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create team')
      }

      toast.success(`Team "${data.team.name}" created successfully`)
      setShowCreateDialog(false)
      resetCreateForm()
      await fetchTeams()
    } catch (error) {
      clientLogger.error('Failed to create team:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create team')
    } finally {
      setCreatingTeam(false)
    }
  }

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

  if (permLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasRosterAccess) {
    return (
      <AccessDenied
        title="Access Denied"
        message="Full admin access is required to manage teams and rosters."
      />
    )
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

  const riskFilter = searchParams.get('risk')
  const isAtRiskFilter = riskFilter === 'at-risk'
  const needsSupervisorFilter = searchParams.get('assignment') === 'unassigned'
  const needsSupervisorCount = teams.filter((team) => !team.supervisor).length
  const visibleTeams = teams.filter((team) =>
    (!isAtRiskFilter || team._count.warnings > 0) &&
    (!needsSupervisorFilter || !team.supervisor)
  )
  const availableSupervisors = supervisors.filter(
    (supervisor) =>
      supervisor.isActive &&
      supervisor.universityId === teamForm.universityId
  )

  const columns = [
    {
      key: 'name',
      header: 'Team',
      sortable: true,
      render: (team: Team) => (
        <button
          onClick={() => {
            router.push(`/admin/teams/${team.id}`)
          }}
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
        team.supervisor ? (
          <div>
            <span className="text-text-secondary">{team.supervisor.firstName} {team.supervisor.lastName}</span>
            <p className="text-xs text-text-muted">{team.supervisor.email}</p>
          </div>
        ) : <Badge variant="warning">Needs supervisor</Badge>
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
              onClick={() => router.push(`/admin/teams/${team.id}`)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage Roster
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
      <PageHeader
        title="Teams"
        description={
          resolvedSeason
            ? `${resolvedSeason.name} (${resolvedSeason.status}) · ${summary.activeTeams} active, ${summary.pendingTeams} pending, ${summary.disqualifiedTeams} disqualified`
            : 'No operational season available'
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/teams/import?template=select-context">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download Template
              </Link>
            </Button>
            {resolvedSeason ? (
              <Button asChild variant="outline">
                <Link href="/admin/teams/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Import
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Import
              </Button>
            )}
            <Button onClick={() => void openCreateDialog()} disabled={!resolvedSeason}>
              <Plus className="mr-2 h-4 w-4" />
              Add Team
            </Button>
          </>
        }
      />

      {!resolvedSeason && (
        <Card className="border-dashed border-border">
          <CardContent className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground">No operational season is available.</p>
              <p className="text-sm text-text-secondary">
                Create, activate, or resume a season before adding or importing teams.
              </p>
            </div>
            <Button asChild>
              <Link href="/admin/season">Go to Season Management</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {resolvedSeason && isAtRiskFilter && (
        <Card className="border-warning/20 bg-warning-background/70">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium text-foreground">At-risk teams filter active</p>
              <p className="text-sm text-text-secondary">
                Showing teams with one or more warnings.
              </p>
            </div>
            <Badge variant="warning">{visibleTeams.length} teams</Badge>
          </CardContent>
        </Card>
      )}

      {resolvedSeason && needsSupervisorFilter ? (
        <Card className="border-warning/20 bg-warning-background/70">
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium text-foreground">Needs-supervisor filter active</p>
              <p className="text-sm text-text-secondary">These teams remain usable by students but require a new advisor.</p>
            </div>
            <Button asChild variant="outline"><Link href="/admin/teams">Clear filter</Link></Button>
          </CardContent>
        </Card>
      ) : null}

      {resolvedSeason && (
        <>
          <div className="grid gap-6 md:grid-cols-5">
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
                <p className="text-3xl font-bold text-success">{summary.activeTeams}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-warning/20 bg-warning-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">{summary.pendingTeams}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-error/20 bg-error-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Disqualified</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-error">{summary.disqualifiedTeams}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-warning/20 bg-warning-background/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-text-secondary">Needs Supervisor</CardTitle></CardHeader>
              <CardContent>
                <Button asChild variant="ghost" className="h-auto p-0 text-3xl font-bold text-warning">
                  <Link href="/admin/teams?assignment=unassigned">{needsSupervisorCount}</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {visibleTeams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-text-muted" />
                <h3 className="mb-2 text-lg font-medium text-foreground">
                  {isAtRiskFilter ? 'No At-Risk Teams' : needsSupervisorFilter ? 'No Teams Need a Supervisor' : 'No Teams Yet'}
                </h3>
                <p className="text-text-secondary">
                  {isAtRiskFilter
                    ? 'No teams currently have warning-based disqualification risk.'
                    : needsSupervisorFilter
                      ? 'Every current team has an assigned supervisor.'
                    : 'Teams will appear here once supervisors create them.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={visibleTeams}
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
        </>
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

      <ConfirmDialog
        open={reinstateTarget !== null}
        onOpenChange={(open) => { if (!open) setReinstateTarget(null) }}
        title="Reinstate Team"
        description={`Reinstate team "${reinstateTarget?.name}"? They will be able to participate again.`}
        confirmLabel="Reinstate"
        loading={actionLoading === reinstateTarget?.id}
        onConfirm={() => { if (reinstateTarget) executeReinstate(reinstateTarget) }}
      />

      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open)
          if (!open) {
            resetCreateForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team</DialogTitle>
            <DialogDescription>
              Create a draft team with season, university, team name, optional external ID, and supervisor.
            </DialogDescription>
          </DialogHeader>
          {loadingCreateOptions ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-season">Season</Label>
                <Select
                  value={teamForm.seasonId}
                  onValueChange={(value) => setTeamForm((current) => ({ ...current, seasonId: value }))}
                  disabled={creatingTeam}
                >
                  <SelectTrigger id="team-season">
                    <SelectValue placeholder="Select season..." />
                  </SelectTrigger>
                  <SelectContent>
                    {seasons.map((season) => (
                      <SelectItem key={season.id} value={season.id}>
                        {season.name} ({season.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-university">University</Label>
                <Select
                  value={teamForm.universityId}
                  onValueChange={(value) =>
                    setTeamForm((current) => ({
                      ...current,
                      universityId: value,
                      supervisorId: '',
                    }))
                  }
                  disabled={creatingTeam}
                >
                  <SelectTrigger id="team-university">
                    <SelectValue placeholder="Select university..." />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((university) => (
                      <SelectItem key={university.id} value={university.id}>
                        {university.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={teamForm.name}
                  onChange={(event) =>
                    setTeamForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Enter team name"
                  disabled={creatingTeam}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-external-id">External Team ID (optional)</Label>
                <Input
                  id="team-external-id"
                  value={teamForm.externalTeamId}
                  onChange={(event) =>
                    setTeamForm((current) => ({ ...current, externalTeamId: event.target.value }))
                  }
                  placeholder="Optional external identifier"
                  disabled={creatingTeam}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-supervisor">Supervisor</Label>
                <Select
                  value={teamForm.supervisorId}
                  onValueChange={(value) => setTeamForm((current) => ({ ...current, supervisorId: value }))}
                  disabled={creatingTeam || !teamForm.universityId}
                >
                  <SelectTrigger id="team-supervisor">
                    <SelectValue placeholder={teamForm.universityId ? 'Select supervisor...' : 'Choose a university first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSupervisors.map((supervisor) => (
                      <SelectItem key={supervisor.id} value={supervisor.id}>
                        {supervisor.firstName} {supervisor.lastName} ({supervisor.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {teamForm.universityId && availableSupervisors.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No active supervisors under the team cap are available for this university.
                  </p>
                ) : null}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={creatingTeam}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creatingTeam || loadingCreateOptions}>
                  {creatingTeam ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Add Team'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
