'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Crown, Loader2, Search, UserMinus, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageLoader } from '@/components/ui/page-loader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  formatPersonOptionLabel,
  getMinimumRosterRequirementMessage,
  getRosterRestrictionMessage,
  isRosterBlockedStatus,
} from '@/features/teams/roster-ui'
import { teamStatusMeta } from '@/lib/status-metadata'

interface TeamMember {
  id: string
  isSubmitter: boolean
  joinedAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
}

interface Team {
  id: string
  name: string
  displayId: string
  status: string
  members: TeamMember[]
}

interface EligibleStudentResult {
  id: string
  email: string
  firstName: string
  lastName: string
}

function getPersonLabel(person: {
  firstName?: string | null
  lastName?: string | null
  email: string
}) {
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return fullName || person.email
}

export default function TeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = String(params.id)
  const [team, setTeam] = useState<Team | null>(null)
  const [viewerCanManage, setViewerCanManage] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentResult[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [searchingStudents, setSearchingStudents] = useState(false)
  const [eligibleStudentsLoaded, setEligibleStudentsLoaded] = useState(false)
  const [submitterLoading, setSubmitterLoading] = useState<string | null>(null)
  const [removeLoading, setRemoveLoading] = useState<string | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [replacementMemberId, setReplacementMemberId] = useState('')

  const fetchTeam = useCallback(async () => {
    try {
      const res = await csrfFetch(`/api/teams/${teamId}`)
      if (res.ok) {
        const data = await res.json()
        setTeam(data.team)
        setTeamName(data.team.name)
        setViewerCanManage(Boolean(data.viewerCanManage))
      }
    } catch (err) {
      clientLogger.error('Failed to fetch team:', err)
      toast.error('Failed to load team details')
    } finally {
      setLoading(false)
    }
  }, [teamId])

  const fetchEligibleStudents = useCallback(
    async (query: string) => {
      if (!viewerCanManage) return

      setSearchingStudents(true)
      try {
        const searchParams = new URLSearchParams({ query })
        const res = await csrfFetch(`/api/teams/${teamId}/eligible-students?${searchParams.toString()}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.message || 'Failed to load eligible students')
        }

        setEligibleStudents(data.students || [])
      } catch (err) {
        clientLogger.error('Failed to fetch eligible students:', err)
        setEligibleStudents([])
      } finally {
        setSearchingStudents(false)
        setEligibleStudentsLoaded(true)
      }
    },
    [teamId, viewerCanManage]
  )

  useEffect(() => {
    void fetchTeam()
  }, [fetchTeam])

  useEffect(() => {
    if (!team || !viewerCanManage || isRosterBlockedStatus(team.status) || team.members.length >= 5) {
      setEligibleStudents([])
      setSelectedStudentId('')
      setEligibleStudentsLoaded(false)
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchEligibleStudents(memberSearch)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [fetchEligibleStudents, memberSearch, team, viewerCanManage])

  useEffect(() => {
    if (selectedStudentId && !eligibleStudents.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId('')
    }
  }, [eligibleStudents, selectedStudentId])

  const replacementOptions = useMemo(() => {
    if (!team || !memberToRemove) return []
    return team.members.filter((member) => member.id !== memberToRemove.id)
  }, [memberToRemove, team])

  const isRosterLocked = team ? isRosterBlockedStatus(team.status) : false
  const rosterRestrictionMessage = team ? getRosterRestrictionMessage(team.status) : ''
  const minimumRosterRequirementMessage = team ? getMinimumRosterRequirementMessage(team.status, team.members.length) : ''
  const isAtMemberCap = team ? team.members.length >= 5 : false
  const canAddMembers = viewerCanManage && !isRosterLocked && !isAtMemberCap
  const rosterActionHelperText = useMemo(() => {
    if (!team) return ''
    if (isRosterLocked) {
      return rosterRestrictionMessage
    }
    return minimumRosterRequirementMessage
  }, [isRosterLocked, minimumRosterRequirementMessage, rosterRestrictionMessage, team])
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
  const getRemoveDisabledReason = useCallback(
    (member: TeamMember) => {
      if (isRosterLocked) {
        return rosterRestrictionMessage
      }
      if (team?.members.length === 1 && team.members[0]?.id === member.id) {
        return minimumRosterRequirementMessage
      }
      return ''
    },
    [isRosterLocked, minimumRosterRequirementMessage, rosterRestrictionMessage, team]
  )

  const handleRenameTeam = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSavingName(true)

    try {
      const res = await csrfFetch(`/api/teams/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Failed to rename team')
        return
      }

      setTeam(data.team)
      setTeamName(data.team.name)
      toast.success('Team name updated')
    } catch {
      setError('An error occurred while renaming the team')
    } finally {
      setSavingName(false)
    }
  }

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setAddingMember(true)

    try {
      const res = await csrfFetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedStudentId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Failed to add member')
        return
      }

      setMemberSearch('')
      setSelectedStudentId('')
      await fetchTeam()
    } catch {
      setError('An error occurred')
    } finally {
      setAddingMember(false)
    }
  }

  const openRemoveDialog = (member: TeamMember) => {
    setMemberToRemove(member)
    setReplacementMemberId('')
    setRemoveDialogOpen(true)
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    setRemoveLoading(memberToRemove.id)
    try {
      const res = await csrfFetch(`/api/teams/${teamId}/members/${memberToRemove.id}`, {
        method: 'DELETE',
        headers:
          memberToRemove.isSubmitter && replacementOptions.length > 0
            ? { 'Content-Type': 'application/json' }
            : undefined,
        body:
          memberToRemove.isSubmitter && replacementOptions.length > 0
            ? JSON.stringify({ replacementMemberId })
            : undefined,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Failed to remove member')
        return
      }

      setRemoveDialogOpen(false)
      setMemberToRemove(null)
      setReplacementMemberId('')
      await fetchTeam()
    } catch {
      setError('Failed to remove member')
    } finally {
      setRemoveLoading(null)
    }
  }

  const handleSetSubmitter = async (memberId: string) => {
    setSubmitterLoading(memberId)
    try {
      const res = await csrfFetch(`/api/teams/${teamId}/submitter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || 'Failed to set submitter')
        return
      }

      await fetchTeam()
    } catch {
      setError('Failed to set submitter')
    } finally {
      setSubmitterLoading(null)
    }
  }

  if (loading) {
    return <PageLoader message="Loading team details..." />
  }

  if (!team) {
    return <div className="py-12 text-center text-text-secondary">Team not found</div>
  }

  const teamStatus = teamStatusMeta[team.status as keyof typeof teamStatusMeta]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{team.name}</h1>
            {teamStatus && <Badge variant={teamStatus.tone}>{teamStatus.label}</Badge>}
          </div>
          <p className="text-text-secondary">{team.displayId}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/teams')}>
          Back to Teams
        </Button>
      </div>

      {viewerCanManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Team Settings</CardTitle>
            <CardDescription>Rename the team and manage current roster ownership.</CardDescription>
          </CardHeader>
          <form onSubmit={handleRenameTeam}>
            <CardContent className="space-y-4">
              {error && <AlertBanner variant="error">{error}</AlertBanner>}
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  maxLength={100}
                  required
                />
              </div>
              <Button type="submit" disabled={savingName || teamName.trim() === team.name}>
                {savingName ? 'Saving...' : 'Save Team Name'}
              </Button>
            </CardContent>
          </form>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {team.members.length}/5 members. One member must be the submitter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rosterActionHelperText ? <p className="mb-4 text-sm text-text-secondary">{rosterActionHelperText}</p> : null}
          {team.members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-secondary px-4 py-6 text-center text-text-secondary">
              No members yet
            </div>
          ) : (
            <div className="space-y-3">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <p className="text-sm text-text-secondary">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.isSubmitter ? (
                      <Badge variant="info" className="gap-1">
                        <Crown className="h-3 w-3" />
                        Submitter
                      </Badge>
                    ) : viewerCanManage ? (
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetSubmitter(member.id)}
                          disabled={isRosterLocked || submitterLoading === member.id}
                        >
                          {submitterLoading === member.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Make submitter'
                          )}
                        </Button>
                        {isRosterLocked ? (
                          <p className="max-w-[13rem] text-right text-xs text-text-muted">{rosterRestrictionMessage}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {viewerCanManage ? (
                      <div className="flex flex-col items-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openRemoveDialog(member)}
                          className="text-error hover:bg-error-background hover:text-error"
                          disabled={Boolean(getRemoveDisabledReason(member)) || removeLoading === member.id}
                        >
                          {removeLoading === member.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="mr-2 h-4 w-4" />
                          )}
                          Remove
                        </Button>
                        {!isRosterLocked && getRemoveDisabledReason(member) ? (
                          <p className="max-w-[13rem] text-right text-xs text-text-muted">
                            {getRemoveDisabledReason(member)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {viewerCanManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add Existing Student</CardTitle>
            <CardDescription>
              Add a registered student from the same university who is not already assigned in this season.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAddMember}>
            <CardContent className="space-y-4">
              {error && <AlertBanner variant="error">{error}</AlertBanner>}
              {!canAddMembers && addMemberHelperText ? (
                <AlertBanner variant="warning" title="Roster changes are limited">
                  {addMemberHelperText}
                </AlertBanner>
              ) : null}
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
                        {formatPersonOptionLabel(student)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {searchingStudents ? <p className="text-xs text-text-muted">Searching students...</p> : null}
                {canAddMembers && addMemberHelperText && !searchingStudents ? (
                  <p className="text-xs text-text-muted">{addMemberHelperText}</p>
                ) : null}
              </div>

              <Button type="submit" disabled={!canAddMembers || !selectedStudentId || addingMember}>
                {addingMember ? (
                  'Adding...'
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add member
                  </>
                )}
              </Button>
            </CardContent>
          </form>
        </Card>
      )}

      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              {memberToRemove
                ? `Remove ${memberToRemove.user.firstName} ${memberToRemove.user.lastName} from ${team.name}?`
                : 'Remove this member from the team?'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {memberToRemove?.isSubmitter && replacementOptions.length > 0 ? (
              <>
                <AlertBanner variant="warning" title="Submitter replacement required">
                  Choose the next submitter before removing the current submitter.
                </AlertBanner>
                <div className="space-y-2">
                  <Label htmlFor="replacement-member">Replacement submitter</Label>
                  <Select value={replacementMemberId} onValueChange={setReplacementMemberId}>
                    <SelectTrigger id="replacement-member">
                      <SelectValue placeholder="Select a replacement" />
                    </SelectTrigger>
                    <SelectContent>
                      {replacementOptions.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {formatPersonOptionLabel(member.user)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setRemoveDialogOpen(false)
                  setMemberToRemove(null)
                  setReplacementMemberId('')
                }}
                disabled={removeLoading === memberToRemove?.id}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleRemoveMember()}
                disabled={
                  removeLoading === memberToRemove?.id ||
                  Boolean(memberToRemove?.isSubmitter && replacementOptions.length > 0 && !replacementMemberId)
                }
              >
                {removeLoading === memberToRemove?.id ? 'Removing...' : 'Remove member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
