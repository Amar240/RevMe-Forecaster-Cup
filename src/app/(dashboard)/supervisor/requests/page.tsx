'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, UserPlus, Users, CheckCircle, XCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface JoinRequest {
  id: string
  status: string
  message: string | null
  createdAt: string
  student: {
    id: string
    firstName: string
    lastName: string
    email: string
    university: { name: string } | null
  }
  requestedTeam: {
    id: string
    name: string
    displayId: string
    status: string
  } | null
}

interface Team {
  id: string
  name: string
  memberCount: number
}

const joinableStatuses = new Set(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE'])

export default function SupervisorRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeams, setSelectedTeams] = useState<Record<string, string>>({})
  const [showNewTeamFor, setShowNewTeamFor] = useState<string | null>(null)

  useEffect(() => {
    void fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [requestsRes, teamsRes] = await Promise.all([
        csrfFetch('/api/supervisor/join-requests'),
        csrfFetch('/api/teams'),
      ])

      if (requestsRes.ok) {
        const data = await requestsRes.json() as { requests?: JoinRequest[] }
        setRequests(data.requests || [])
      }

      if (teamsRes.ok) {
        const data = await teamsRes.json() as {
          teams?: {
            id: string
            name: string
            status: string
            members: unknown[]
          }[]
        }

        setTeams(
          data.teams
            ?.map((team) => ({
              id: team.id,
              name: team.name,
              memberCount: team.members?.length || 0,
              status: team.status,
            }))
            .filter((team) => joinableStatuses.has(team.status) && team.memberCount < 5)
            .map(({ status: _status, ...team }) => team) || []
        )
      }
    } catch (err) {
      clientLogger.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (requestId: string, action: string, teamId?: string, teamName?: string) => {
    setProcessing(requestId)
    try {
      const res = await csrfFetch('/api/supervisor/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, teamId, teamName }),
      })

      const data = await res.json() as { message?: string }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to process request')
      }

      await fetchData()
      setShowNewTeamFor(null)
      setNewTeamName('')
      setSelectedTeams((current) => {
        const next = { ...current }
        delete next[requestId]
        return next
      })
    } catch (err) {
      clientLogger.error('Failed to process request:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to process request')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Student Join Requests</h1>
        <p className="text-text-secondary">Review and accept students into your teams</p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserPlus className="mx-auto mb-4 h-12 w-12 text-text-muted" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No Pending Requests</h3>
            <p className="text-text-secondary">Students will appear here when they request to join your teams</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const selectedTeam = selectedTeams[request.id] || ''
            const requestedTeamOption = request.requestedTeam
              ? teams.find((team) => team.id === request.requestedTeam?.id) ?? null
              : null

            return (
              <Card key={request.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    {request.student.firstName} {request.student.lastName}
                  </CardTitle>
                  <CardDescription>
                    {request.student.email}
                    {request.student.university && ` - ${request.student.university.name}`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {request.message && (
                    <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3 text-sm text-text-secondary">
                      {request.message}
                    </div>
                  )}

                  {request.requestedTeam && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-info/20 bg-info-background/60 px-4 py-3 text-sm">
                      <Badge variant="info">Preferred Team</Badge>
                      <span className="text-text-secondary">
                        {request.requestedTeam.name} ({request.requestedTeam.displayId})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Clock className="h-4 w-4 text-text-muted" />
                    Requested {new Date(request.createdAt).toLocaleDateString()}
                  </div>

                  {showNewTeamFor === request.id ? (
                    <div className="space-y-3 rounded-lg border border-info/20 bg-info-background/60 p-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="info">New Team</Badge>
                        <p className="font-medium text-foreground">Create a team for this student</p>
                      </div>
                      <Input
                        placeholder="Team Name"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => void handleAction(request.id, 'accept', undefined, newTeamName)}
                          disabled={!newTeamName || processing === request.id}
                        >
                          {processing === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Create & Add'
                          )}
                        </Button>
                        <Button variant="outline" onClick={() => setShowNewTeamFor(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {requestedTeamOption && (
                        <Button
                          onClick={() => void handleAction(request.id, 'accept')}
                          disabled={processing === request.id}
                        >
                          {processing === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" /> Add to Requested Team
                            </>
                          )}
                        </Button>
                      )}

                      {teams.length > 0 && (
                        <Select
                          value={selectedTeam}
                          onValueChange={(value) =>
                            setSelectedTeams((current) => ({ ...current, [request.id]: value }))
                          }
                        >
                          <SelectTrigger className="w-[240px]">
                            <SelectValue placeholder="Select existing team..." />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name} ({team.memberCount}/5)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {selectedTeam && (
                        <Button
                          onClick={() => void handleAction(request.id, 'accept', selectedTeam)}
                          disabled={processing === request.id}
                        >
                          {processing === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" /> Add to Team
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => setShowNewTeamFor(request.id)}
                        className="border-info/20 bg-info-background/60 text-info hover:bg-info-background"
                      >
                        <UserPlus className="h-4 w-4 mr-1" /> New Team
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => void handleAction(request.id, 'reject')}
                        disabled={processing === request.id}
                        className="border-error/20 bg-error-background/60 text-error hover:bg-error-background"
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
