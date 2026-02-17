'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, UserPlus, Users, CheckCircle, XCircle, Clock } from 'lucide-react'

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
}

interface Team {
  id: string
  name: string
  memberCount: number
}

export default function SupervisorRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [showNewTeamFor, setShowNewTeamFor] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [requestsRes, teamsRes] = await Promise.all([
        csrfFetch('/api/supervisor/join-requests'),
        csrfFetch('/api/teams'),
      ])

      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setRequests(data.requests || [])
      }

      if (teamsRes.ok) {
        const data = await teamsRes.json()
        setTeams(data.teams?.map((t: { id: string; name: string; members: unknown[] }) => ({
          id: t.id,
          name: t.name,
          memberCount: t.members?.length || 0,
        })) || [])
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

      if (res.ok) {
        fetchData()
        setShowNewTeamFor(null)
        setNewTeamName('')
        setSelectedTeam('')
      }
    } catch (err) {
      clientLogger.error('Failed to process request:', err)
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Join Requests</h1>
        <p className="text-gray-600">Review and accept students into your teams</p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UserPlus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Requests</h3>
            <p className="text-gray-500">Students will appear here when they request to join your teams</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  {request.student.firstName} {request.student.lastName}
                </CardTitle>
                <CardDescription>
                  {request.student.email}
                  {request.student.university && ` - ${request.student.university.name}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.message && (
                  <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{request.message}</p>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  Requested {new Date(request.createdAt).toLocaleDateString()}
                </div>

                {showNewTeamFor === request.id ? (
                  <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                    <p className="font-medium text-blue-900">Create New Team</p>
                    <Input
                      placeholder="Team Name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAction(request.id, 'accept', undefined, newTeamName)}
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
                    {teams.filter(t => t.memberCount < 5).length > 0 && (
                      <select
                        className="border rounded-lg px-3 py-2 text-sm"
                        value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}
                      >
                        <option value="">Select existing team...</option>
                        {teams.filter(t => t.memberCount < 5).map(team => (
                          <option key={team.id} value={team.id}>
                            {team.name} ({team.memberCount}/5)
                          </option>
                        ))}
                      </select>
                    )}

                    {selectedTeam && (
                      <Button
                        onClick={() => handleAction(request.id, 'accept', selectedTeam)}
                        disabled={processing === request.id}
                        className="bg-green-600 hover:bg-green-700"
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
                      className="border-blue-200 text-blue-600"
                    >
                      <UserPlus className="h-4 w-4 mr-1" /> New Team
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleAction(request.id, 'reject')}
                      disabled={processing === request.id}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

