'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserMinus, Crown } from 'lucide-react'
import { PageLoader } from '@/components/ui/page-loader'
import { toast } from 'sonner'

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-green-100 text-green-700' },
  PENDING_APPROVAL: { label: 'Pending Approval', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-700' },
  DISQUALIFIED: { label: 'Disqualified', className: 'bg-red-100 text-red-700' },
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
    fetchTeam()
  }, [fetchTeam])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
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
      fetchTeam()
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
      fetchTeam()
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
      fetchTeam()
    } catch {
      setError('Failed to set submitter')
    }
  }

  if (loading) {
    return <PageLoader message="Loading team details…" />
  }

  if (!team) {
    return <div className="text-center py-12">Team not found</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            {STATUS_BADGES[team.status] && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGES[team.status].className}`}>
                {STATUS_BADGES[team.status].label}
              </span>
            )}
          </div>
          <p className="text-gray-600">{team.displayId}</p>
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
            <p className="text-gray-500 text-center py-4">No members yet</p>
          ) : (
            <div className="space-y-3">
              {team.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{member.user.email}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {member.isSubmitter ? (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center">
                        <Crown className="h-3 w-3 mr-1" />
                        Submitter
                      </span>
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
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            <CardDescription>
              Add a student by their registered email address.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleAddMember}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-md text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Student Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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




