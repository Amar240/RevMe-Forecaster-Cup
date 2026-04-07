'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRightLeft,
  Crown,
  Loader2,
  Search,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { usePermissions } from '@/hooks/usePermissions'
import { teamStatusMeta } from '@/lib/status-metadata'
import { AccessDenied } from '@/components/ui/access-denied'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { PageLoader } from '@/components/ui/page-loader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface AdminRosterMember {
  id: string
  userId: string
  isSubmitter: boolean
  joinedAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    role: string
  }
}

interface TeamSummary {
  id: string
  name: string
  displayId: string
  status: keyof typeof teamStatusMeta
  season: { id: string; name: string } | null
  university: { id: string; name: string }
  supervisor: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  members: AdminRosterMember[]
  _count: {
    submissions: number
    warnings: number
    supportTickets?: number
  }
}

interface AuditEntry {
  id: string
  action: string
  userEmail: string | null
  userRole: string | null
  createdAt: string
  details: Record<string, unknown> | null
}

interface EligibleStudentResult {
  id: string
  email: string
  firstName: string
  lastName: string
}

interface EligibleSupervisorResult {
  id: string
  email: string
  firstName: string
  lastName: string
}

const blockedAssignmentStatuses = new Set(['REJECTED', 'DISQUALIFIED', 'ARCHIVED'])
const currentManagedStatuses = new Set(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE'])

const actionLabels: Record<string, string> = {
  TEAM_RENAMED: 'Team renamed',
  TEAM_MEMBER_ADDED: 'Member added',
  TEAM_MEMBER_REMOVED: 'Member removed',
  TEAM_SUBMITTER_CHANGED: 'Submitter changed',
  TEAM_SUPERVISOR_CHANGED: 'Supervisor changed',
  TEAM_MEMBER_MOVED: 'Member moved',
  TEAM_MEMBERS_BULK_MOVED: 'Members moved',
  DISQUALIFY_TEAM: 'Team disqualified',
  REINSTATE_TEAM: 'Team reinstated',
  TEAM_APPROVED: 'Team approved',
  TEAM_REJECTED: 'Team rejected',
}

function getPersonLabel(person: {
  firstName?: string | null
  lastName?: string | null
  email: string
}) {
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return fullName || person.email
}

function formatAuditMessage(entry: AuditEntry) {
  const details = entry.details ?? {}
  switch (entry.action) {
    case 'TEAM_RENAMED':
      return `${String(details.previousName ?? 'Previous name')} -> ${String(details.nextName ?? 'Updated')}`
    case 'TEAM_MEMBER_ADDED':
      return `Added ${String(details.memberEmail ?? 'student')}`
    case 'TEAM_MEMBER_REMOVED':
      return `Removed ${String(details.removedEmail ?? 'member')}`
    case 'TEAM_SUBMITTER_CHANGED':
      return `Submitter set to ${String(details.nextSubmitterEmail ?? 'member')}`
    case 'TEAM_SUPERVISOR_CHANGED':
      return `${String(details.previousSupervisorEmail ?? 'Unassigned')} -> ${String(details.nextSupervisorEmail ?? 'Updated')}`
    case 'TEAM_MEMBER_MOVED':
    case 'TEAM_MEMBERS_BULK_MOVED':
      return `Moved ${(details.movedEmails as string[] | undefined)?.join(', ') ?? 'selected members'}`
    case 'DISQUALIFY_TEAM':
      return String(details.reason ?? 'Admin decision')
    case 'TEAM_REJECTED':
      return String(details.reason ?? 'No reason provided')
    default:
      return entry.action
  }
}

function getRosterRestrictionMessage(status: TeamSummary['status']) {
  switch (status) {
    case 'ARCHIVED':
      return 'Member changes are unavailable while this team is archived.'
    case 'REJECTED':
      return 'Member changes are unavailable while this team is rejected.'
    case 'DISQUALIFIED':
      return 'Member changes are unavailable while this team is disqualified.'
    default:
      return ''
  }
}

function getTeamStatusBanner(team: TeamSummary): {
  variant: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
} {
  switch (team.status) {
    case 'DRAFT':
      return {
        variant: 'info',
        title: 'Draft team',
        message:
          'This team is still being prepared. Team settings, roster updates, and supervisor changes are available before participation begins.',
      }
    case 'PENDING_APPROVAL':
      return {
        variant: 'warning',
        title: 'Pending approval',
        message:
          'This team is under review. Roster updates and supervisor changes are still available while approval is pending.',
      }
    case 'APPROVED':
      return {
        variant: 'info',
        title: 'Approved team',
        message:
          'This team is approved. Roster updates, submitter changes, and supervisor reassignment remain available.',
      }
    case 'ACTIVE':
      return {
        variant: 'success',
        title: 'Active team',
        message:
          'This team is active. Roster updates, submitter changes, and supervisor reassignment are available right now.',
      }
    case 'ARCHIVED':
      return {
        variant: 'info',
        title: 'Archived team',
        message:
          'This team is archived. Roster updates, submitter changes, and member moves are unavailable while the team remains visible for reference.',
      }
    case 'REJECTED':
      return {
        variant: 'error',
        title: 'Rejected team',
        message:
          'This team is rejected. Roster updates, submitter changes, and member moves are unavailable unless the team returns to a managed status later.',
      }
    case 'DISQUALIFIED':
      return {
        variant: 'error',
        title: 'Disqualified team',
        message:
          'This team is disqualified. Roster updates, submitter changes, and member moves are unavailable, but the team remains visible for operations and history.',
      }
    default:
      return {
        variant: 'info',
        title: 'Team status',
        message: 'Review the current team state before making changes.',
      }
  }
}

export default function AdminTeamDetailPage() {
  const params = useParams()
  const { loading: permLoading, isAdmin, hasFullAccess } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [savingSupervisor, setSavingSupervisor] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [submitterLoading, setSubmitterLoading] = useState<string | null>(null)
  const [removeLoading, setRemoveLoading] = useState<string | null>(null)
  const [moveLoading, setMoveLoading] = useState(false)
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [searchingSupervisors, setSearchingSupervisors] = useState(false)
  const [teamDirectoryLoading, setTeamDirectoryLoading] = useState(false)
  const [eligibleStudentsLoaded, setEligibleStudentsLoaded] = useState(false)
  const [team, setTeam] = useState<TeamSummary | null>(null)
  const [teamDirectory, setTeamDirectory] = useState<TeamSummary[]>([])
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([])
  const [teamName, setTeamName] = useState('')
  const [rosterError, setRosterError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentResult[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [supervisorSearch, setSupervisorSearch] = useState('')
  const [eligibleSupervisors, setEligibleSupervisors] = useState<EligibleSupervisorResult[]>([])
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('')
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<AdminRosterMember | null>(null)
  const [replacementMemberId, setReplacementMemberId] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [targetTeamId, setTargetTeamId] = useState('')
  const [moveSourceReplacementMemberId, setMoveSourceReplacementMemberId] = useState('')
  const [targetSubmitterMemberId, setTargetSubmitterMemberId] = useState('')

  const teamId = String(params.id)
  const hasRosterAccess = isAdmin || hasFullAccess

  const fetchTeam = useCallback(async () => {
    const res = await csrfFetch(`/api/admin/teams/${teamId}`)
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.message || 'Failed to load team')
    }

    setTeam(data.team)
    setRecentActivity(data.recentActivity || [])
    setTeamName(data.team.name)
    setSelectedSupervisorId(data.team.supervisor?.id ?? '')
    return data.team as TeamSummary
  }, [teamId])

  const fetchTeamDirectory = useCallback(async (seasonId?: string) => {
    setTeamDirectoryLoading(true)
    try {
      const query = seasonId ? `?seasonId=${encodeURIComponent(seasonId)}` : ''
      const res = await csrfFetch(`/api/admin/teams${query}`)
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load teams')
      }

      setTeamDirectory(data.teams || [])
    } finally {
      setTeamDirectoryLoading(false)
    }
  }, [])

  const refreshTeamAndDirectory = useCallback(async () => {
    const nextTeam = await fetchTeam()
    await fetchTeamDirectory(nextTeam.season?.id)
    return nextTeam
  }, [fetchTeam, fetchTeamDirectory])

  const fetchEligibleStudents = useCallback(
    async (query: string) => {
      if (!hasRosterAccess) return

      setSearchingStudents(true)
      try {
        const searchParams = new URLSearchParams({ teamId, query })
        const res = await csrfFetch(`/api/admin/teams/eligible-students?${searchParams.toString()}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || 'Failed to load students')
        }

        setEligibleStudents(data.students || [])
      } finally {
        setSearchingStudents(false)
        setEligibleStudentsLoaded(true)
      }
    },
    [hasRosterAccess, teamId]
  )

  const fetchEligibleSupervisors = useCallback(
    async (query: string) => {
      if (!hasRosterAccess) return

      setSearchingSupervisors(true)
      try {
        const searchParams = new URLSearchParams({ teamId, query })
        const res = await csrfFetch(`/api/admin/teams/eligible-supervisors?${searchParams.toString()}`)
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || 'Failed to load supervisors')
        }

        setEligibleSupervisors(data.supervisors || [])
      } finally {
        setSearchingSupervisors(false)
      }
    },
    [hasRosterAccess, teamId]
  )

  useEffect(() => {
    if (permLoading) return
    if (!hasRosterAccess) {
      setLoading(false)
      return
    }

    setLoading(true)
    void refreshTeamAndDirectory()
      .catch((error) => {
        clientLogger.error('Failed to load admin roster detail:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load team')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [hasRosterAccess, permLoading, refreshTeamAndDirectory])

  useEffect(() => {
    if (!team || blockedAssignmentStatuses.has(team.status) || team.members.length >= 5) {
      setEligibleStudents([])
      setSelectedStudentId('')
      setEligibleStudentsLoaded(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchEligibleStudents(memberSearch)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [fetchEligibleStudents, memberSearch, team])

  useEffect(() => {
    if (!team) {
      setEligibleSupervisors([])
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchEligibleSupervisors(supervisorSearch)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [fetchEligibleSupervisors, supervisorSearch, team])

  useEffect(() => {
    if (!team) return
    setSelectedMemberIds((current) => current.filter((memberId) => team.members.some((member) => member.id === memberId)))
  }, [team])

  useEffect(() => {
    if (team && blockedAssignmentStatuses.has(team.status) && selectedMemberIds.length > 0) {
      setSelectedMemberIds([])
    }
  }, [selectedMemberIds.length, team])

  useEffect(() => {
    if (!removeDialogOpen) {
      setMemberToRemove(null)
      setReplacementMemberId('')
    }
  }, [removeDialogOpen])

  useEffect(() => {
    if (!moveDialogOpen) {
      setTargetTeamId('')
      setMoveSourceReplacementMemberId('')
      setTargetSubmitterMemberId('')
    }
  }, [moveDialogOpen])

  const teamStatus = team ? teamStatusMeta[team.status] : null
  const statusBanner = team ? getTeamStatusBanner(team) : null
  const isRosterLocked = team ? blockedAssignmentStatuses.has(team.status) : false
  const rosterRestrictionMessage = team ? getRosterRestrictionMessage(team.status) : ''
  const isAtMemberCap = team ? team.members.length >= 5 : false
  const canAddMembers = Boolean(team && !isRosterLocked && !isAtMemberCap)
  const moveSelectionDisabled = !team || isRosterLocked || team.members.length === 0
  const allMembersSelected = Boolean(team && team.members.length > 0 && selectedMemberIds.length === team.members.length)
  const singleManagedMemberRemovalLocked = Boolean(
    team && team.members.length === 1 && currentManagedStatuses.has(team.status)
  )

  const replacementOptions = useMemo(() => {
    if (!team || !memberToRemove) return []
    return team.members.filter((member) => member.id !== memberToRemove.id)
  }, [memberToRemove, team])

  const selectedMembers = useMemo(() => {
    if (!team) return []
    return team.members.filter((member) => selectedMemberIds.includes(member.id))
  }, [selectedMemberIds, team])

  const moveSourceRemainingMembers = useMemo(() => {
    if (!team) return []
    return team.members.filter((member) => !selectedMemberIds.includes(member.id))
  }, [selectedMemberIds, team])

  const moveRequiresSourceReplacement = selectedMembers.some((member) => member.isSubmitter) && moveSourceRemainingMembers.length > 0

  const targetTeamOptions = useMemo(() => {
    if (!team) return []
    return teamDirectory.filter(
      (entry) =>
        entry.id !== team.id &&
        entry.university.id === team.university.id &&
        entry.season?.id === team.season?.id &&
        !blockedAssignmentStatuses.has(entry.status)
    )
  }, [team, teamDirectory])

  const selectedTargetTeam = useMemo(
    () => targetTeamOptions.find((entry) => entry.id === targetTeamId) ?? null,
    [targetTeamId, targetTeamOptions]
  )

  const targetNeedsSubmitter = Boolean(
    selectedTargetTeam && !selectedTargetTeam.members.some((member) => member.isSubmitter) && selectedMembers.length > 0
  )

  const targetSubmitterOptions = useMemo(() => {
    if (!selectedTargetTeam) return []
    return [
      ...selectedTargetTeam.members.map((member) => ({
        id: member.id,
        label: `${getPersonLabel(member.user)} (${member.user.email})`,
      })),
      ...selectedMembers.map((member) => ({
        id: member.id,
        label: `${getPersonLabel(member.user)} (${member.user.email})`,
      })),
    ]
  }, [selectedMembers, selectedTargetTeam])

  const moveDisabledReason = useMemo(() => {
    if (!team) return ''
    if (isRosterLocked) {
      return rosterRestrictionMessage
    }
    if (team.members.length === 0) {
      return 'Add a student before moving members.'
    }
    if (!teamDirectoryLoading && targetTeamOptions.length === 0) {
      return 'No same-season destination teams are available.'
    }
    if (selectedMemberIds.length === 0) {
      return 'Select one or more members to move them.'
    }
    return ''
  }, [isRosterLocked, rosterRestrictionMessage, selectedMemberIds.length, targetTeamOptions.length, team, teamDirectoryLoading])

  const addMemberHelperText = useMemo(() => {
    if (!team) return ''
    if (isRosterLocked) {
      return rosterRestrictionMessage
    }
    if (isAtMemberCap) {
      return 'This team is already at the 5-member limit.'
    }
    if (eligibleStudentsLoaded && !searchingStudents && eligibleStudents.length === 0) {
      return 'No eligible students available for this season.'
    }
    return ''
  }, [
    eligibleStudents.length,
    eligibleStudentsLoaded,
    isAtMemberCap,
    isRosterLocked,
    rosterRestrictionMessage,
    searchingStudents,
    team,
  ])

  const rosterHelperText = useMemo(() => {
    if (!team) return ''
    if (isRosterLocked) {
      return rosterRestrictionMessage
    }
    if (team.members.length === 0) {
      return 'Add a student before assigning a submitter or moving members.'
    }
    return moveDisabledReason
  }, [isRosterLocked, moveDisabledReason, rosterRestrictionMessage, team])

  const getRemoveDisabledReason = (member: AdminRosterMember) => {
    if (isRosterLocked) {
      return rosterRestrictionMessage
    }
    if (singleManagedMemberRemovalLocked && team?.members[0]?.id === member.id) {
      return 'This member cannot be removed because this team must keep at least one member in its current status.'
    }
    return ''
  }

  const handleRenameTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!team || teamName.trim() === team.name) return

    setRosterError('')
    setSavingName(true)

    try {
      const res = await csrfFetch(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update team')
      }

      setTeam(data.team)
      setTeamName(data.team.name)
      toast.success('Team name updated')
      await fetchTeamDirectory(data.team.season?.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update team'
      setRosterError(message)
      toast.error(message)
    } finally {
      setSavingName(false)
    }
  }

  const handleReassignSupervisor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!team || !selectedSupervisorId || selectedSupervisorId === team.supervisor?.id) return

    setRosterError('')
    setSavingSupervisor(true)

    try {
      const res = await csrfFetch(`/api/admin/teams/${team.id}/supervisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId: selectedSupervisorId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update supervisor')
      }

      setTeam(data.team)
      setSelectedSupervisorId(data.team.supervisor?.id ?? '')
      toast.success('Supervisor updated')
      await refreshTeamAndDirectory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update supervisor'
      setRosterError(message)
      toast.error(message)
    } finally {
      setSavingSupervisor(false)
    }
  }

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!team || !selectedStudentId) return

    setRosterError('')
    setAddLoading(true)

    try {
      const res = await csrfFetch(`/api/admin/teams/${team.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedStudentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to add member')
      }

      setMemberSearch('')
      setSelectedStudentId('')
      toast.success('Member added to team')
      await refreshTeamAndDirectory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add member'
      setRosterError(message)
      toast.error(message)
    } finally {
      setAddLoading(false)
    }
  }

  const handleSetSubmitter = async (memberId: string) => {
    if (!team) return

    setRosterError('')
    setSubmitterLoading(memberId)

    try {
      const res = await csrfFetch(`/api/admin/teams/${team.id}/submitter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update submitter')
      }

      toast.success('Submitter updated')
      await refreshTeamAndDirectory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update submitter'
      setRosterError(message)
      toast.error(message)
    } finally {
      setSubmitterLoading(null)
    }
  }

  const openRemoveDialog = (member: AdminRosterMember) => {
    setMemberToRemove(member)
    setReplacementMemberId('')
    setRemoveDialogOpen(true)
  }

  const handleRemoveMember = async () => {
    if (!team || !memberToRemove) return

    setRosterError('')
    setRemoveLoading(memberToRemove.id)

    try {
      const requiresReplacement = memberToRemove.isSubmitter && replacementOptions.length > 0
      const res = await csrfFetch(`/api/admin/teams/${team.id}/members/${memberToRemove.id}`, {
        method: 'DELETE',
        headers: requiresReplacement ? { 'Content-Type': 'application/json' } : undefined,
        body: requiresReplacement ? JSON.stringify({ replacementMemberId }) : undefined,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to remove member')
      }

      toast.success('Member removed')
      setRemoveDialogOpen(false)
      await refreshTeamAndDirectory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove member'
      setRosterError(message)
      toast.error(message)
    } finally {
      setRemoveLoading(null)
    }
  }

  const handleMoveMembers = async () => {
    if (!team || !targetTeamId || selectedMemberIds.length === 0) return

    setRosterError('')
    setMoveLoading(true)

    try {
      const res = await csrfFetch('/api/admin/teams/move-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceTeamId: team.id,
          targetTeamId,
          memberIds: selectedMemberIds,
          sourceReplacementMemberId: moveSourceReplacementMemberId || null,
          targetSubmitterMemberId: targetSubmitterMemberId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || 'Failed to move members')
      }

      toast.success(selectedMemberIds.length > 1 ? 'Members moved' : 'Member moved')
      setSelectedMemberIds([])
      setMoveDialogOpen(false)
      await refreshTeamAndDirectory()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to move members'
      setRosterError(message)
      toast.error(message)
    } finally {
      setMoveLoading(false)
    }
  }

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    )
  }

  const toggleSelectAllMembers = () => {
    if (!team) return
    setSelectedMemberIds((current) =>
      current.length === team.members.length ? [] : team.members.map((member) => member.id)
    )
  }

  if (permLoading || loading) {
    return <PageLoader message="Loading roster management..." />
  }

  if (!hasRosterAccess) {
    return (
      <AccessDenied
        title="Access Denied"
        message="Full admin access is required to manage team rosters and structural team operations."
      />
    )
  }

  if (!team) {
    return <div className="py-12 text-center text-text-secondary">Team not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <Link href="/admin/teams" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Back to team management
          </Link>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold text-foreground">{team.name}</h1>
              {teamStatus ? <Badge variant={teamStatus.tone}>{teamStatus.label}</Badge> : null}
            </div>
            <p className="text-sm text-text-secondary">
              Display ID {team.displayId} / {team.university.name} / {team.season?.name ?? 'No season assigned'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setMoveDialogOpen(true)}
              disabled={Boolean(moveDisabledReason)}
            >
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Move selected ({selectedMemberIds.length})
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/teams/${team.id}`}>Open supervisor view</Link>
            </Button>
          </div>
          {moveDisabledReason ? (
            <p className="max-w-sm text-sm text-text-secondary md:text-right">{moveDisabledReason}</p>
          ) : null}
        </div>
      </div>

      {rosterError ? (
        <AlertBanner variant="error" title="Action couldn't be completed">
          {rosterError}
        </AlertBanner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Members</CardDescription>
            <CardTitle className="text-2xl">{team.members.length}/5</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Supervisor</CardDescription>
            <CardTitle className="text-base">
              {team.supervisor ? getPersonLabel(team.supervisor) : 'Unassigned'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Submissions</CardDescription>
            <CardTitle className="text-2xl">{team._count.submissions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Warnings</CardDescription>
            <CardTitle className="text-2xl">{team._count.warnings}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {statusBanner ? (
        <AlertBanner variant={statusBanner.variant} title={statusBanner.title}>
          {statusBanner.message}
        </AlertBanner>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Roster</CardTitle>
                <CardDescription>Manage team members, submitter responsibility, and same-season member moves.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={toggleSelectAllMembers} disabled={moveSelectionDisabled}>
                  <Users className="mr-2 h-4 w-4" />
                  {allMembersSelected ? 'Clear selection' : 'Select all'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMoveDialogOpen(true)}
                  disabled={Boolean(moveDisabledReason)}
                >
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Move selected
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {rosterHelperText ? <p className="text-sm text-text-secondary">{rosterHelperText}</p> : null}
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.08em] text-text-muted">
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allMembersSelected}
                          onChange={toggleSelectAllMembers}
                          aria-label="Select all team members"
                          disabled={moveSelectionDisabled}
                        />
                      </th>
                      <th className="px-3 py-2">Member</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Joined</th>
                      <th className="px-3 py-2">Submitter</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.members.map((member) => (
                      <tr key={member.id} className="rounded-xl border border-border bg-card shadow-sm">
                        <td className="rounded-l-xl px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedMemberIds.includes(member.id)}
                            onChange={() => toggleMemberSelection(member.id)}
                            aria-label={`Select ${member.user.email}`}
                            disabled={moveSelectionDisabled}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{getPersonLabel(member.user)}</p>
                            <p className="text-sm text-text-secondary">{member.user.email}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-text-secondary">{member.user.role}</td>
                        <td className="px-3 py-3 text-sm text-text-secondary">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-3">
                          {member.isSubmitter ? (
                            <Badge variant="info" className="gap-1">
                              <Crown className="h-3.5 w-3.5" />
                              Submitter
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleSetSubmitter(member.id)}
                              disabled={isRosterLocked || submitterLoading === member.id}
                            >
                              {submitterLoading === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Make submitter'
                              )}
                            </Button>
                          )}
                        </td>
                        <td className="rounded-r-xl px-3 py-3">
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRemoveDialog(member)}
                              disabled={Boolean(getRemoveDisabledReason(member))}
                            >
                              <UserMinus className="mr-2 h-4 w-4" />
                              Remove
                            </Button>
                            {!isRosterLocked && getRemoveDisabledReason(member) ? (
                              <p className="max-w-[15rem] text-right text-xs text-text-muted">
                                {getRemoveDisabledReason(member)}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add Existing Student</CardTitle>
              <CardDescription>Add a registered student from the same university who is not already assigned in this season.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canAddMembers && addMemberHelperText ? (
                <AlertBanner variant="warning" title="Roster changes are limited">
                  {addMemberHelperText}
                </AlertBanner>
              ) : null}

              <form className="space-y-4" onSubmit={handleAddMember}>
                <div className="space-y-2">
                  <Label htmlFor="student-search">Find student</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      id="student-search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="pl-9"
                      disabled={!canAddMembers}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Eligible students</Label>
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={!canAddMembers}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleStudents.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {getPersonLabel(student)} ({student.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {searchingStudents ? <p className="text-xs text-text-muted">Searching students...</p> : null}
                  {canAddMembers && addMemberHelperText && !searchingStudents ? (
                    <p className="text-xs text-text-muted">{addMemberHelperText}</p>
                  ) : null}
                </div>

                <Button type="submit" disabled={!canAddMembers || !selectedStudentId || addLoading}>
                  {addLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add member
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Settings</CardTitle>
              <CardDescription>Update the team name or reassign the supervisor for this season.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <form className="space-y-4" onSubmit={handleRenameTeam}>
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team name</Label>
                  <Input
                    id="team-name"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    maxLength={100}
                    required
                  />
                </div>
                <Button type="submit" disabled={savingName || teamName.trim() === team.name}>
                  {savingName ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving
                    </>
                  ) : (
                    'Save team name'
                  )}
                </Button>
              </form>

              <form className="space-y-4" onSubmit={handleReassignSupervisor}>
                <div className="space-y-2">
                  <Label htmlFor="supervisor-search">Find supervisor</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      id="supervisor-search"
                      value={supervisorSearch}
                      onChange={(event) => setSupervisorSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Selected supervisor</Label>
                  <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleSupervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {getPersonLabel(supervisor)} ({supervisor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="submit"
                  disabled={savingSupervisor || !selectedSupervisorId || selectedSupervisorId === team.supervisor?.id}
                >
                  {savingSupervisor ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Save supervisor
                    </>
                  )}
                </Button>
                {searchingSupervisors ? <p className="text-xs text-text-muted">Searching supervisors...</p> : null}
              </form>
            </CardContent>
          </Card>

          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Additional Admin Actions</CardTitle>
              <CardDescription>Additional admin cleanup actions are not available in this version yet.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary">
                Team settings and roster controls are available above. Cleanup and destructive admin actions remain unavailable in this view.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>Recent roster and team management activity for this team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-text-secondary">
                  No team activity recorded yet.
                </div>
              ) : (
                recentActivity.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border bg-surface-secondary p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {actionLabels[entry.action] ?? entry.action}
                        </p>
                        <p className="text-sm text-text-secondary">{formatAuditMessage(entry)}</p>
                      </div>
                      <Badge variant="neutral">{entry.userRole ?? 'SYSTEM'}</Badge>
                    </div>
                    <div className="mt-3 text-xs text-text-muted">
                      {entry.userEmail ?? 'System'} - {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Move Readiness</CardTitle>
              <CardDescription>Supporting context for same-season member moves.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-text-secondary">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-medium text-foreground">Target pool</p>
                  <p>{teamDirectoryLoading ? 'Refreshing same-season teams...' : `${targetTeamOptions.length} valid destination teams available`}</p>
                  {!teamDirectoryLoading && targetTeamOptions.length === 0 ? (
                    <p className="mt-1 text-xs text-text-muted">No same-season destination teams are available.</p>
                  ) : null}
                </div>
                <Badge variant="info">{team.season?.name ?? 'No season'}</Badge>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="font-medium text-foreground">Selected members</p>
                  <p>{selectedMemberIds.length} currently staged for move</p>
                  {!selectedMemberIds.length ? (
                    <p className="mt-1 text-xs text-text-muted">Select one or more members to move them.</p>
                  ) : null}
                </div>
                <Badge
                  variant={
                    isRosterLocked
                      ? 'neutral'
                      : selectedMemberIds.length > 0 && targetTeamOptions.length > 0
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {isRosterLocked
                    ? 'Unavailable'
                    : selectedMemberIds.length > 0 && targetTeamOptions.length > 0
                      ? 'Action ready'
                      : 'Select members'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              {memberToRemove?.isSubmitter && replacementOptions.length > 0
                ? 'Choose a replacement submitter before removing the current submitter.'
                : 'This member will be removed from the team roster.'}
            </DialogDescription>
          </DialogHeader>
          {memberToRemove ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-secondary p-4">
                <p className="font-medium text-foreground">{getPersonLabel(memberToRemove.user)}</p>
                <p className="text-sm text-text-secondary">{memberToRemove.user.email}</p>
              </div>

              {memberToRemove.isSubmitter && replacementOptions.length > 0 ? (
                <div className="space-y-2">
                  <Label>Replacement submitter</Label>
                  <Select value={replacementMemberId} onValueChange={setReplacementMemberId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose replacement" />
                    </SelectTrigger>
                    <SelectContent>
                      {replacementOptions.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {getPersonLabel(member.user)} ({member.user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => void handleRemoveMember()}
              disabled={Boolean(memberToRemove?.isSubmitter && replacementOptions.length > 0 && !replacementMemberId) || Boolean(removeLoading)}
            >
              {removeLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing
                </>
              ) : (
                'Remove member'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Move selected members</DialogTitle>
            <DialogDescription>
              Move one or more members from this team into another team within the same university and season.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-surface-secondary p-4">
              <p className="font-medium text-foreground">Members selected</p>
              <p className="mt-1 text-sm text-text-secondary">
                {selectedMembers.map((member) => getPersonLabel(member.user)).join(', ') || 'No members selected'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Target team</Label>
              <Select value={targetTeamId} onValueChange={setTargetTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose destination team" />
                </SelectTrigger>
                <SelectContent>
                  {targetTeamOptions.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name} - {entry.members.length}/5 members
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {moveRequiresSourceReplacement ? (
              <div className="space-y-2">
                <Label>Replacement submitter for source team</Label>
                <Select value={moveSourceReplacementMemberId} onValueChange={setMoveSourceReplacementMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose replacement submitter" />
                  </SelectTrigger>
                  <SelectContent>
                    {moveSourceRemainingMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {getPersonLabel(member.user)} ({member.user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {targetNeedsSubmitter ? (
              <div className="space-y-2">
                <Label>Submitter for target team</Label>
                <Select value={targetSubmitterMemberId} onValueChange={setTargetSubmitterMemberId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose target submitter" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetSubmitterOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {selectedTargetTeam ? (
              <AlertBanner variant="info" title="Move summary">
                {selectedTargetTeam.name} currently has {selectedTargetTeam.members.length} members and{' '}
                {selectedTargetTeam.members.some((member) => member.isSubmitter)
                  ? 'already has a submitter.'
                  : 'needs a submitter assigned during this move.'}
              </AlertBanner>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleMoveMembers()}
              disabled={
                moveLoading ||
                selectedMemberIds.length === 0 ||
                !targetTeamId ||
                (moveRequiresSourceReplacement && !moveSourceReplacementMemberId) ||
                (targetNeedsSubmitter && !targetSubmitterMemberId)
              }
            >
              {moveLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Moving
                </>
              ) : (
                <>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Confirm move
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
