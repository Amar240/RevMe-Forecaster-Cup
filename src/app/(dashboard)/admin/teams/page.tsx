'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, AlertTriangle, Check, Ban, RefreshCw, MoreVertical } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table'
import { CardSkeleton, TableSkeleton } from '@/components/ui/skeleton'
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

const STATUS_CONFIG: Record<TeamStatus, { label: string; bgColor: string; textColor: string; icon: React.ElementType }> = {
  DRAFT: { label: 'Draft', bgColor: 'bg-gray-100', textColor: 'text-gray-700', icon: AlertTriangle },
  PENDING_APPROVAL: { label: 'Pending', bgColor: 'bg-amber-100', textColor: 'text-amber-700', icon: AlertTriangle },
  APPROVED: { label: 'Approved', bgColor: 'bg-blue-100', textColor: 'text-blue-700', icon: Check },
  ACTIVE: { label: 'Active', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: Check },
  REJECTED: { label: 'Rejected', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: Ban },
  DISQUALIFIED: { label: 'Disqualified', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: AlertTriangle },
}

export default function AdminTeamsPage() {
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [totalTeams, setTotalTeams] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [disqualifyReason, setDisqualifyReason] = useState('')
  const [showDisqualifyDialog, setShowDisqualifyDialog] = useState(false)
  const [showTeamDetails, setShowTeamDetails] = useState(false)

  const fetchTeams = useCallback(async () => {
    try {
      const res = await csrfFetch(`/api/admin/teams?page=${page}&pageSize=${pageSize}`)
      if (res.ok) {
        const data = await res.json()
        setTeams(data.teams || [])
        setTotalTeams(data.totalTeams || 0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch teams:', error)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

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
        alert(data.message || 'Failed to disqualify team')
      }
    } catch (error) {
      clientLogger.error('Disqualify failed:', error)
      alert('An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReinstate = async (team: Team) => {
    if (!confirm(`Reinstate team "${team.name}"? They will be able to participate again.`)) return
    setActionLoading(team.id)
    try {
      const res = await csrfFetch(`/api/admin/teams/${team.id}/reinstate`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        fetchTeams()
      } else {
        alert(data.message || 'Failed to reinstate team')
      }
    } catch (error) {
      clientLogger.error('Reinstate failed:', error)
      alert('An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <TableSkeleton rows={5} columns={7} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeTeams = teams.filter((t) => t.status === 'ACTIVE')
  const pendingTeams = teams.filter((t) => t.status === 'PENDING_APPROVAL' || t.status === 'APPROVED' || t.status === 'DRAFT')
  const disqualifiedTeams = teams.filter((t) => t.status === 'DISQUALIFIED' || t.status === 'REJECTED')
  const totalPages = Math.max(1, Math.ceil(totalTeams / pageSize))

  const columns = [
    {
      key: 'name',
      header: 'Team',
      sortable: true,
      render: (team: Team) => (
        <button
          onClick={() => { setSelectedTeam(team); setShowTeamDetails(true) }}
          className="text-left hover:text-blue-600"
        >
          <p className="font-medium">{team.name}</p>
          <p className="text-xs text-gray-500">{team.displayId}</p>
        </button>
      ),
    },
    {
      key: 'university.name',
      header: 'University',
      sortable: true,
      render: (team: Team) => (
        <span className="text-gray-600">{team.university.name}</span>
      ),
    },
    {
      key: 'supervisor',
      header: 'Supervisor',
      render: (team: Team) => (
        <div>
          <span className="text-gray-700">
            {team.supervisor.firstName} {team.supervisor.lastName}
          </span>
          <p className="text-xs text-gray-500">{team.supervisor.email}</p>
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
        <span className={team._count.warnings >= 2 ? 'text-amber-600 font-medium' : ''}>
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
          <span className={`inline-flex items-center text-xs ${config.bgColor} ${config.textColor} px-2 py-1 rounded-full`}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </span>
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
                className="text-red-600"
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
                className="text-green-600"
                onClick={() => handleReinstate(team)}
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
        <h1 className="text-2xl font-bold text-gray-900">All Teams</h1>
        <p className="text-gray-600">
          {activeTeams.length} active, {pendingTeams.length} pending, {disqualifiedTeams.length} disqualified
        </p>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-gray-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalTeams}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{activeTeams.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{pendingTeams.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Disqualified</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{disqualifiedTeams.length}</p>
          </CardContent>
        </Card>
      </div>

      {teams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Teams Yet</h3>
            <p className="text-gray-500">Teams will appear here once supervisors create them.</p>
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
              pageSize={15}
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
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
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
                  <p className="text-gray-500">Status</p>
                  <p className={`font-medium ${selectedTeam.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedTeam.status}
                  </p>
                  {selectedTeam.disqualifiedReason && (
                    <p className="text-xs text-gray-500 mt-1">{selectedTeam.disqualifiedReason}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-500">University</p>
                  <p className="font-medium">{selectedTeam.university.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Submissions</p>
                  <p className="font-medium">{selectedTeam._count.submissions}</p>
                </div>
                <div>
                  <p className="text-gray-500">Warnings</p>
                  <p className={`font-medium ${selectedTeam._count.warnings >= 2 ? 'text-amber-600' : ''}`}>
                    {selectedTeam._count.warnings}/3
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Supervisor</p>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">
                    {selectedTeam.supervisor.firstName} {selectedTeam.supervisor.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedTeam.supervisor.email}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">Members ({selectedTeam.members.length}/5)</p>
                <div className="space-y-2">
                  {selectedTeam.members.map((member, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                      <div>
                        <p className="font-medium">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                      {member.isSubmitter && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                          Submitter
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

