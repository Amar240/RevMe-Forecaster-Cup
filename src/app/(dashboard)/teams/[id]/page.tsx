'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Crown, Loader2, UserMinus, Users } from 'lucide-react'
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

export default function TeamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [team, setTeam] = useState<Team | null>(null)
  const [viewerCanManage, setViewerCanManage] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [submitterLoading, setSubmitterLoading] = useState<string | null>(null)
  const [removeLoading, setRemoveLoading] = useState<string | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  const [replacementMemberId, setReplacementMemberId] = useState('')

  const fetchTeam = useCallback(async () => {
    try {
      const res = await csrfFetch(`/api/teams/${params.id}`)
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
  }, [params.id])

  useEffect(() => {
    void fetchTeam()
  }, [fetchTeam])

  const replacementOptions = useMemo(() => {
    if (!team || !memberToRemove) return []
    return team.members.filter((member) => member.id !== memberToRemove.id)
  }, [memberToRemove, team])

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
      const res = await csrfFetch(`/api/teams/${params.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Failed to add member')
        return
      }

      setEmail('')
      void fetchTeam()
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
      const res = await csrfFetch(`/api/teams/${params.id}/members/${memberToRemove.id}`, {
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
      const res = await csrfFetch(`/api/teams/${params.id}/submitter`, {
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetSubmitter(member.id)}
                        disabled={submitterLoading === member.id}
                        title="Make submitter"
                      >
                        {submitterLoading === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Crown className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}
                    {viewerCanManage ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRemoveDialog(member)}
                        className="text-error hover:bg-error-background hover:text-error"
                        disabled={removeLoading === member.id}
                      >
                        {removeLoading === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {viewerCanManage && team.members.length < 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Add Member</CardTitle>
            <CardDescription>Add a student by their registered email address.</CardDescription>
          </CardHeader>
          <form onSubmit={handleAddMember}>
            <CardContent className="space-y-4">
              {error && <AlertBanner variant="error">{error}</AlertBanner>}
              <div className="space-y-2">
                <Label htmlFor="email">Student Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={addingMember}>
                {addingMember ? 'Adding...' : 'Add Member'}
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
                          {member.user.firstName} {member.user.lastName} ({member.user.email})
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
                {removeLoading === memberToRemove?.id ? 'Removing...' : 'Remove Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
