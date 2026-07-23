'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Clock, Loader2, Send, Users, XCircle } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface JoinRequest {
  id: string
  status: string
  message: string | null
  createdAt: string
  supervisor: { firstName: string; lastName: string; email: string } | null
  supervisorEmailEntered: string | null
  requestedTeam: { id: string; name: string; displayId: string; status: string } | null
}

interface SupervisorOption {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface TeamOption {
  id: string
  name: string
  displayId: string
  status: string
  memberCount: number
}

interface JoinRequestOptionsResponse {
  studentUniversity: { id: string; name: string } | null
  supervisors: SupervisorOption[]
}

const NO_TEAM_VALUE = '__no_team__'

export default function JoinTeamPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('')
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState(NO_TEAM_VALUE)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [studentUniversity, setStudentUniversity] = useState<JoinRequestOptionsResponse['studentUniversity']>(null)
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([])

  useEffect(() => {
    void fetchPageData()
  }, [])

  useEffect(() => {
    if (!selectedSupervisorId) {
      setTeamOptions([])
      setSelectedTeamId(NO_TEAM_VALUE)
      return
    }

    let cancelled = false
    setTeamsLoading(true)

    void (async () => {
      try {
        const res = await csrfFetch(`/api/join-requests/teams?supervisorId=${encodeURIComponent(selectedSupervisorId)}`)
        const data = await res.json() as { teams?: TeamOption[]; message?: string }

        if (!res.ok) {
          throw new Error(data.message || 'Failed to load available teams')
        }

        if (!cancelled) {
          setTeamOptions(data.teams || [])
          setSelectedTeamId(NO_TEAM_VALUE)
        }
      } catch (err) {
        if (!cancelled) {
          clientLogger.error('Failed to fetch joinable teams:', err)
          toast.error(err instanceof Error ? err.message : 'Failed to load available teams')
          setTeamOptions([])
          setSelectedTeamId(NO_TEAM_VALUE)
        }
      } finally {
        if (!cancelled) {
          setTeamsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedSupervisorId])

  const fetchPageData = async () => {
    try {
      const [requestsRes, optionsRes] = await Promise.all([
        csrfFetch('/api/join-requests'),
        csrfFetch('/api/join-requests/options'),
      ])

      const requestsData = await requestsRes.json() as { requests?: JoinRequest[]; message?: string }
      const optionsData = await optionsRes.json() as JoinRequestOptionsResponse & { message?: string }

      if (!requestsRes.ok) {
        throw new Error(requestsData.message || 'Failed to load join requests')
      }

      if (!optionsRes.ok) {
        throw new Error(optionsData.message || 'Failed to load join-request options')
      }

      setRequests(requestsData.requests || [])
      setStudentUniversity(optionsData.studentUniversity || null)
      setSupervisors(optionsData.supervisors || [])
    } catch (err) {
      clientLogger.error('Failed to fetch join-team data:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to load join-team page')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!selectedSupervisorId) {
      setError('Select a supervisor before sending your request.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        supervisorId: selectedSupervisorId,
        teamId: selectedTeamId !== NO_TEAM_VALUE ? selectedTeamId : undefined,
        message: message.trim() || undefined,
      }

      const res = await csrfFetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json() as { message?: string }

      if (!res.ok) {
        setError(data.message || 'Failed to send request')
      } else {
        setSuccess('Join request sent successfully.')
        setSelectedSupervisorId('')
        setSelectedTeamId(NO_TEAM_VALUE)
        setTeamOptions([])
        setMessage('')
        await fetchPageData()
      }
    } catch {
      setError('Failed to send request')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelRequest = async (requestId: string) => {
    try {
      const res = await csrfFetch(`/api/join-requests?id=${requestId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchPageData()
      }
    } catch (err) {
      clientLogger.error('Failed to cancel request:', err)
      toast.error('Failed to cancel request')
    }
  }

  const pendingRequest = requests.find((request) => request.status === 'PENDING')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Join a Team</h1>
        <p className="text-text-secondary">Request to join a supervisor from your university.</p>
      </div>

      {!pendingRequest ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Join Request
            </CardTitle>
            <CardDescription>
              Select a supervisor from your university and optionally choose one of their teams.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!studentUniversity ? (
              <AlertBanner variant="error">
                Add your university to your account before requesting to join a team.
              </AlertBanner>
            ) : supervisors.length === 0 ? (
              <AlertBanner variant="warning">
                No supervisors are available yet for {studentUniversity.name}. Try again later or contact support.
              </AlertBanner>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-xl border border-border bg-surface-secondary px-4 py-3">
                  <p className="text-sm font-medium text-foreground">Your university</p>
                  <p className="text-sm text-text-secondary">{studentUniversity.name}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supervisorId">Supervisor</Label>
                  <Select
                    value={selectedSupervisorId}
                    onValueChange={setSelectedSupervisorId}
                  >
                    <SelectTrigger id="supervisorId" aria-label="Supervisor">
                      <SelectValue placeholder="Select a supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisors.map((supervisor) => (
                        <SelectItem key={supervisor.id} value={supervisor.id}>
                          {supervisor.firstName} {supervisor.lastName} ({supervisor.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedSupervisorId && (
                  <div className="space-y-2">
                    <Label htmlFor="teamId">Preferred Team (Optional)</Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger id="teamId" aria-label="Preferred Team">
                        <SelectValue placeholder={teamsLoading ? 'Loading teams...' : 'Let the supervisor decide'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM_VALUE}>Let the supervisor decide</SelectItem>
                        {teamOptions.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name} ({team.memberCount}/5)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {teamsLoading ? (
                      <p className="text-sm text-text-muted">Loading same-season teams for this supervisor...</p>
                    ) : teamOptions.length === 0 ? (
                      <p className="text-sm text-text-muted">
                        No open teams are available for this supervisor right now. You can still send the request and let the supervisor place you later.
                      </p>
                    ) : (
                      <p className="text-sm text-text-muted">
                        You can leave this unset if you want the supervisor to choose the best team for you.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="message">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Introduce yourself or add any context for the supervisor."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={4}
                  />
                </div>

                {error && <AlertBanner variant="error">{error}</AlertBanner>}
                {success && <AlertBanner variant="success">{success}</AlertBanner>}

                <Button type="submit" disabled={submitting || !selectedSupervisorId} className="w-full">
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Request'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-warning/20 bg-warning-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-warning" />
              Pending Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-text-secondary">
              You have a pending request to{' '}
              <strong className="text-foreground">
                {pendingRequest.supervisor
                  ? `${pendingRequest.supervisor.firstName} ${pendingRequest.supervisor.lastName}`
                  : pendingRequest.supervisorEmailEntered}
              </strong>
            </p>
            {pendingRequest.requestedTeam && (
              <div className="flex items-center gap-2">
                <Badge variant="info">Preferred Team</Badge>
                <span className="text-sm text-text-secondary">
                  {pendingRequest.requestedTeam.name} ({pendingRequest.requestedTeam.displayId})
                </span>
              </div>
            )}
            <p className="text-sm text-text-secondary">Sent {new Date(pendingRequest.createdAt).toLocaleDateString()}</p>
            <Button variant="outline" onClick={() => void cancelRequest(pendingRequest.id)}>
              Cancel Request
            </Button>
          </CardContent>
        </Card>
      )}

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-text-secondary" />
              Request History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id} className="space-y-3 rounded-lg border border-border bg-surface-secondary p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {request.supervisor
                          ? `${request.supervisor.firstName} ${request.supervisor.lastName}`
                          : request.supervisorEmailEntered}
                      </p>
                      <p className="text-sm text-text-secondary">{new Date(request.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {request.status === 'PENDING' && (
                        <Badge variant="warning" className="gap-1">
                          <Clock className="h-4 w-4" />
                          Pending
                        </Badge>
                      )}
                      {request.status === 'ACCEPTED' && (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Accepted
                        </Badge>
                      )}
                      {request.status === 'REJECTED' && (
                        <Badge variant="error" className="gap-1">
                          <XCircle className="h-4 w-4" />
                          Rejected
                        </Badge>
                      )}
                      {request.status === 'CANCELED' && (
                        <Badge variant="neutral" className="gap-1">
                          <XCircle className="h-4 w-4" />
                          Canceled
                        </Badge>
                      )}
                    </div>
                  </div>

                  {request.requestedTeam && (
                    <p className="text-sm text-text-secondary">
                      Preferred team: <span className="font-medium text-foreground">{request.requestedTeam.name}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
