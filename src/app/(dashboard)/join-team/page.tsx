'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Clock, Loader2, Send, Users, XCircle } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'

interface JoinRequest {
  id: string
  status: string
  message: string | null
  createdAt: string
  supervisor: { firstName: string; lastName: string; email: string } | null
  supervisorEmailEntered: string | null
}

export default function JoinTeamPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [supervisorEmail, setSupervisorEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const res = await csrfFetch('/api/join-requests')
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests || [])
      }
    } catch (err) {
      clientLogger.error('Failed to fetch requests:', err)
      toast.error('Failed to load join requests')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const res = await csrfFetch('/api/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorEmail, message }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Failed to send request')
      } else {
        setSuccess('Request sent successfully.')
        setSupervisorEmail('')
        setMessage('')
        await fetchRequests()
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
        await fetchRequests()
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
        <p className="text-text-secondary">Request to join a supervisor&apos;s team</p>
      </div>

      {!pendingRequest ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Send Join Request
            </CardTitle>
            <CardDescription>Enter your supervisor&apos;s email to request joining their team.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supervisorEmail">Supervisor Email</Label>
                <Input
                  id="supervisorEmail"
                  type="email"
                  placeholder="supervisor@university.edu"
                  value={supervisorEmail}
                  onChange={(event) => setSupervisorEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message (Optional)</Label>
                <Input
                  id="message"
                  placeholder="Introduce yourself..."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>

              {error && <AlertBanner variant="error">{error}</AlertBanner>}
              {success && <AlertBanner variant="success">{success}</AlertBanner>}

              <Button type="submit" disabled={submitting} className="w-full">
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
                <div key={request.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary p-3">
                  <div>
                    <p className="font-medium text-foreground">
                      {request.supervisor ? `${request.supervisor.firstName} ${request.supervisor.lastName}` : request.supervisorEmailEntered}
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
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
