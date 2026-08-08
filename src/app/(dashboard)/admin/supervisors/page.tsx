'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/ui/data-table'
import { CardSkeleton, TableSkeleton, Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ArrowUpRight,
  Edit,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  UserCog,
  Users,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/ui/access-denied'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { SupervisorTransitionDialog } from '@/components/admin/supervisor-transition-dialog'
import { SupervisorAffiliationCorrectionDialog } from '@/components/admin/supervisor-affiliation-correction-dialog'

interface Supervisor {
  id: string
  firstName: string
  lastName: string
  email: string
  isActive: boolean
  universityId: string | null
  university: { id: string; name: string } | null
  _count: { supervisedTeams: number; currentTeams?: number; historicalTeams?: number }
}

interface University {
  id: string
  name: string
}

interface TeamSummary {
  id: string
  name: string
  displayId: string
  university: { id: string; name: string }
  supervisor: { firstName: string; lastName: string } | null
}

export default function AdminSupervisorsPage() {
  const { loading: permLoading, isAdmin, hasFullAccess } = usePermissions()
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [universities, setUniversities] = useState<University[]>([])
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    universityId: '',
  })

  const [assignTarget, setAssignTarget] = useState<Supervisor | null>(null)
  const [unassignedTeams, setUnassignedTeams] = useState<TeamSummary[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignReason, setAssignReason] = useState('')
  const [statusTarget, setStatusTarget] = useState<Supervisor | null>(null)
  const [transitionTarget, setTransitionTarget] = useState<Supervisor | null>(null)
  const [correctionTarget, setCorrectionTarget] = useState<Supervisor | null>(null)

  const hasAccess = isAdmin || hasFullAccess

  const fetchSupervisors = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/supervisors')
      if (res.ok) {
        const data = await res.json()
        setSupervisors(data.supervisors || [])
      }
    } catch (error) {
      clientLogger.error('Failed to fetch supervisors:', error)
      toast.error('Failed to load supervisors')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUniversities = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/universities')
      if (res.ok) {
        const data = await res.json()
        setUniversities(data.universities || [])
      }
    } catch (error) {
      clientLogger.error('Failed to fetch universities:', error)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && hasAccess) {
      void fetchSupervisors()
      void fetchUniversities()
    }
  }, [fetchSupervisors, fetchUniversities, hasAccess, permLoading])

  const resetForm = () => {
    setEditingSupervisor(null)
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      universityId: '',
    })
  }

  const openCreateForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = (supervisor: Supervisor) => {
    setEditingSupervisor(supervisor)
    setForm({
      firstName: supervisor.firstName,
      lastName: supervisor.lastName,
      email: supervisor.email,
      universityId: supervisor.universityId || '',
    })
    setShowForm(true)
  }

  const openTransition = (supervisor: Supervisor) => {
    setTransitionTarget(supervisor)
  }

  const fetchAssignableTeams = async (supervisor: Supervisor) => {
    setAssignTarget(supervisor)
    setSelectedTeamIds([])
    setAssignReason('')
    setLoadingTeams(true)

    try {
      const res = await csrfFetch('/api/admin/teams')
      if (res.ok) {
        const data = await res.json()
        const teams: TeamSummary[] = data.teams || []
        const filtered = teams.filter((team) => !team.supervisor && team.university.id === supervisor.universityId)
        setUnassignedTeams(filtered)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch teams:', error)
      toast.error('Failed to load teams')
    } finally {
      setLoadingTeams(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.universityId) {
      toast.error('All fields are required')
      return
    }

    setSubmitting(true)
    try {
      if (editingSupervisor) {
        const res = await csrfFetch(`/api/admin/supervisors/${editingSupervisor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json() as { message?: string }
        if (!res.ok) throw new Error(data.message || 'Failed to update supervisor')
        toast.success('Supervisor updated successfully')
      } else {
        const createdEmail = form.email.trim()
        const res = await csrfFetch('/api/admin/supervisors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json() as {
          devPassword?: string | null
          emailSent?: boolean
          message?: string
        }
        if (!res.ok) throw new Error(data.message || 'Failed to create supervisor')
        if (data.devPassword) {
          toast.success(`Account created! Dev login: ${data.devPassword}`, {
            duration: 15000,
            description: `${createdEmail} can log in with password: ${data.devPassword}`,
          })
        } else {
          toast.success(
            data.emailSent
              ? `Supervisor created and password reset email sent to ${createdEmail}`
              : 'Supervisor created. Password reset email could not be sent.'
          )
        }
      }

      resetForm()
      setShowForm(false)
      await fetchSupervisors()
    } catch (error) {
      clientLogger.error('Failed to save supervisor:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save supervisor')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAssign = async () => {
    if (!assignTarget || selectedTeamIds.length === 0) return

    setAssigning(true)
    try {
      const res = await csrfFetch(`/api/admin/supervisors/${assignTarget.id}/assign-teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds: selectedTeamIds, reason: assignReason }),
      })
      const data = await res.json() as { teamsUpdated?: number; message?: string }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to assign teams')
      }

      toast.success(`${data.teamsUpdated} team(s) assigned to ${assignTarget.firstName} ${assignTarget.lastName}`)
      setAssignTarget(null)
      await fetchSupervisors()
    } catch (error) {
      clientLogger.error('Failed to assign teams:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign teams')
    } finally {
      setAssigning(false)
    }
  }

  const executeStatusChange = async (supervisor: Supervisor) => {
    setActionLoading(supervisor.id)
    try {
      const res = await csrfFetch(`/api/admin/supervisors/${supervisor.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !supervisor.isActive }),
      })
      const data = await res.json() as { message?: string }
      if (!res.ok) throw new Error(data.message || 'Failed to update supervisor status')

      toast.success(supervisor.isActive ? 'Supervisor deactivated' : 'Supervisor reactivated')
      await fetchSupervisors()
    } catch (error) {
      clientLogger.error('Failed to update supervisor status:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update supervisor status')
    } finally {
      setActionLoading(null)
      setStatusTarget(null)
    }
  }

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds((current) =>
      current.includes(teamId)
        ? current.filter((id) => id !== teamId)
        : [...current, teamId]
    )
  }

  if (permLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Access Denied"
        message="Admin access is required to manage supervisor accounts."
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <CardSkeleton />
        <Card>
          <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
          <CardContent><TableSkeleton rows={5} columns={6} /></CardContent>
        </Card>
      </div>
    )
  }

  const activeSupervisors = supervisors.filter((supervisor) => supervisor.isActive)
  const inactiveSupervisors = supervisors.filter((supervisor) => !supervisor.isActive)

  const columns = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (supervisor: Supervisor) => (
        <span className="font-medium">{supervisor.firstName} {supervisor.lastName}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (supervisor: Supervisor) => (
        <span className="text-text-secondary">{supervisor.email}</span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (supervisor: Supervisor) => (
        <Badge variant={supervisor.isActive ? 'success' : 'neutral'}>
          {supervisor.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'university.name',
      header: 'University',
      sortable: true,
      render: (supervisor: Supervisor) => (
        <span className="text-text-secondary">{supervisor.university?.name ?? '—'}</span>
      ),
    },
    {
      key: 'teams',
      header: 'Teams',
      className: 'text-center',
      render: (supervisor: Supervisor) => (
        <div>
          <span className="font-medium">{supervisor._count.currentTeams ?? supervisor._count.supervisedTeams} current</span>
          <p className="text-xs text-text-muted">{supervisor._count.historicalTeams ?? 0} historical</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (supervisor: Supervisor) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={actionLoading === supervisor.id}>
              {actionLoading === supervisor.id ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditForm(supervisor)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Supervisor
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => void fetchAssignableTeams(supervisor)}
              disabled={!isAdmin || !supervisor.universityId || !supervisor.isActive}
            >
              <Users className="mr-2 h-4 w-4" />
              Assign unassigned teams
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/teams">
                <UserCog className="mr-2 h-4 w-4" />
                Manage team assignments
              </Link>
            </DropdownMenuItem>
            {isAdmin ? (
              <DropdownMenuItem onClick={() => setCorrectionTarget(supervisor)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Correct university affiliation
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => supervisor.isActive && isAdmin
                ? openTransition(supervisor)
                : setStatusTarget(supervisor)}
            >
              {supervisor.isActive ? 'Deactivate Supervisor' : 'Reactivate Supervisor'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supervisors</h1>
          <p className="text-text-secondary">{supervisors.length} supervisor{supervisors.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4 mr-2" />
            Add Supervisor
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/users">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              View All Users
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card variant="metric" className="bg-gradient-to-br from-surface-secondary to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <UserCog className="mr-2 h-4 w-4 text-foreground" />
              Total Supervisors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-foreground">{supervisors.length}</p>
          </CardContent>
        </Card>
        <Card variant="metric" className="border-success/10 bg-gradient-to-br from-success-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <Users className="mr-2 h-4 w-4 text-success" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-success">{activeSupervisors.length}</p>
          </CardContent>
        </Card>
        <Card variant="metric" className="border-warning/10 bg-gradient-to-br from-warning-background to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-text-secondary">
              <UserCog className="mr-2 h-4 w-4 text-warning" />
              Inactive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-warning">{inactiveSupervisors.length}</p>
          </CardContent>
        </Card>
      </div>

      {supervisors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserCog className="mx-auto mb-4 h-12 w-12 text-text-muted" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No Supervisors Yet</h3>
            <p className="text-text-secondary">Add supervisors to assign them to teams.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Supervisors</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={supervisors}
              columns={columns}
              searchKeys={['firstName', 'lastName', 'email', 'university.name']}
              searchPlaceholder="Search by name, email, or university..."
              pageSize={20}
              filters={[
                {
                  key: 'isActive',
                  label: 'Status',
                  options: [
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Inactive' },
                  ],
                },
              ]}
            />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupervisor ? 'Edit Supervisor' : 'Add Supervisor'}</DialogTitle>
            <DialogDescription>
              {editingSupervisor
                ? 'Update the supervisor name or email here. Use the guided transition to change universities.'
                : 'Create a new supervisor account. A password reset email will be sent automatically.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sup-first">First Name</Label>
                <Input
                  id="sup-first"
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sup-last">Last Name</Label>
                <Input
                  id="sup-last"
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  required
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-email">Email</Label>
              <Input
                id="sup-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sup-university">University</Label>
              {editingSupervisor ? (
                <>
                  <div id="sup-university" className="rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-foreground">
                    {editingSupervisor.university?.name ?? 'No university'}
                  </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    setShowForm(false)
                    setCorrectionTarget(editingSupervisor)
                  }}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Correct university affiliation
                </Button>
                </>
              ) : (
                <Select
                  value={form.universityId}
                  onValueChange={(value) => setForm((current) => ({ ...current, universityId: value }))}
                  disabled={submitting}
                >
                  <SelectTrigger id="sup-university"><SelectValue placeholder="Select university..." /></SelectTrigger>
                  <SelectContent>
                    {universities.map((university) => <SelectItem key={university.id} value={university.id}>{university.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingSupervisor ? (
                  'Save Changes'
                ) : (
                  'Add Supervisor'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignTarget !== null} onOpenChange={(open) => { if (!open) setAssignTarget(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Teams</DialogTitle>
            <DialogDescription>
              {assignTarget && (
                <>Assigning teams to <strong>{assignTarget.firstName} {assignTarget.lastName}</strong>. Only unassigned teams from the same university are shown.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {loadingTeams ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : unassignedTeams.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-secondary">No matching unassigned teams available.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {unassignedTeams.map((team) => (
                  <label
                    key={team.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={selectedTeamIds.includes(team.id)}
                      onCheckedChange={() => toggleTeam(team.id)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{team.name}</p>
                      <p className="text-xs text-text-muted">{team.displayId} · {team.university.name}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="assign-team-reason">Reason</Label>
            <Input
              id="assign-team-reason"
              value={assignReason}
              onChange={(event) => setAssignReason(event.target.value)}
              placeholder="Example: Filling a temporary advisor gap"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={selectedTeamIds.length === 0 || assignReason.trim().length < 5 || assigning}>
              {assigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign${selectedTeamIds.length > 0 ? ` (${selectedTeamIds.length})` : ''}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null)
        }}
        title={statusTarget?.isActive ? 'Deactivate Supervisor' : 'Reactivate Supervisor'}
        description={
          statusTarget?.isActive
            ? `Deactivate ${statusTarget?.firstName} ${statusTarget?.lastName}? This is blocked while teams are still assigned to that supervisor.`
            : `Reactivate ${statusTarget?.firstName} ${statusTarget?.lastName}? They will be able to sign in again immediately.`
        }
        confirmLabel={statusTarget?.isActive ? 'Deactivate' : 'Reactivate'}
        variant={statusTarget?.isActive ? 'destructive' : 'default'}
        loading={actionLoading === statusTarget?.id}
        onConfirm={() => {
          if (statusTarget) void executeStatusChange(statusTarget)
        }}
      />

      <SupervisorTransitionDialog
        open={transitionTarget !== null}
        supervisor={transitionTarget}
        universities={universities}
        operation="DEACTIVATE"
        onOpenChange={(open) => { if (!open) setTransitionTarget(null) }}
        onCompleted={fetchSupervisors}
      />
      <SupervisorAffiliationCorrectionDialog
        open={correctionTarget !== null}
        supervisor={correctionTarget}
        universities={universities}
        onOpenChange={(open) => { if (!open) setCorrectionTarget(null) }}
        onCompleted={fetchSupervisors}
      />
    </div>
  )
}
