'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Crown, UserMinus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageLoader } from '@/components/ui/page-loader'

const STATUS_BADGES: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'info' | 'error' }
> = {
  ACTIVE: { label: 'Active', variant: 'success' },
  PENDING_APPROVAL: { label: 'Pending Approval', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'info' },
  REJECTED: { label: 'Rejected', variant: 'error' },
  DISQUALIFIED: { label: 'Disqualified', variant: 'error' },
}

interface TeamMember {
  id: string
  isSubmitter: boolean
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
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  const fetchTeam = useCallback(async () => {
    try {
      const res = await csrfFetch(`/api/teams/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setTeam(data.team)
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

  const handleRemoveMember = async (memberId: string) => {
    try {
      await csrfFetch(`/api/teams/${params.id}/members/${memberId}`, {
        method: 'DELETE',
      })
      void fetchTeam()
    } catch {
      setError('Failed to remove member')
    }
  }

  const handleSetSubmitter = async (memberId: string) => {
    try {
      await csrfFetch(`/api/teams/${params.id}/submitter`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      })
      void fetchTeam()
    } catch {
      setError('Failed to set submitter')
    }
  }

  if (loading) {
    return <PageLoader message="Loading team details..." />
  }

  if (!team) {
    return <div className="py-12 text-center text-text-secondary">Team not found</div>
  }

  const teamStatus = STATUS_BADGES[team.status]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{team.name}</h1>
            {teamStatus && <Badge variant={teamStatus.variant}>{teamStatus.label}</Badge>}
          </div>
          <p className="text-text-secondary">{team.displayId}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/teams')}>
          Back to Teams
        </Button>
      </div>

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
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetSubmitter(member.id)}
                        title="Make submitter"
                      >
                        <Crown className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-error hover:bg-error-background hover:text-error"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {team.members.length < 5 && (
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
    </div>
  )
}
