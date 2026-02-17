'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Send, Clock, CheckCircle, XCircle, Users } from 'lucide-react'

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
    fetchRequests()
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
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
        setSuccess('Request sent successfully!')
        setSupervisorEmail('')
        setMessage('')
        fetchRequests()
      }
    } catch (err) {
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
        fetchRequests()
      }
    } catch (err) {
      clientLogger.error('Failed to cancel request:', err)
    }
  }

  const pendingRequest = requests.find(r => r.status === 'PENDING')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Join a Team</h1>
        <p className="text-gray-600">Request to join a supervisor&apos;s team</p>
      </div>

      {!pendingRequest ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Send Join Request
            </CardTitle>
            <CardDescription>
              Enter your supervisor&apos;s email to request joining their team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="supervisorEmail">Supervisor Email</Label>
                <Input
                  id="supervisorEmail"
                  type="email"
                  placeholder="supervisor@university.edu"
                  value={supervisorEmail}
                  onChange={(e) => setSupervisorEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="message">Message (Optional)</Label>
                <Input
                  id="message"
                  placeholder="Introduce yourself..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
              )}
              {success && (
                <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">{success}</p>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <Clock className="h-5 w-5" />
              Pending Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-amber-700">
              You have a pending request to{' '}
              <strong>
                {pendingRequest.supervisor
                  ? `${pendingRequest.supervisor.firstName} ${pendingRequest.supervisor.lastName}`
                  : pendingRequest.supervisorEmailEntered}
              </strong>
            </p>
            <p className="text-sm text-amber-600">
              Sent {new Date(pendingRequest.createdAt).toLocaleDateString()}
            </p>
            <Button
              variant="outline"
              onClick={() => cancelRequest(pendingRequest.id)}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Cancel Request
            </Button>
          </CardContent>
        </Card>
      )}

      {requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              Request History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {request.supervisor
                        ? `${request.supervisor.firstName} ${request.supervisor.lastName}`
                        : request.supervisorEmailEntered}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status === 'PENDING' && (
                      <span className="flex items-center gap-1 text-amber-600 text-sm">
                        <Clock className="h-4 w-4" /> Pending
                      </span>
                    )}
                    {request.status === 'ACCEPTED' && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" /> Accepted
                      </span>
                    )}
                    {request.status === 'REJECTED' && (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="h-4 w-4" /> Rejected
                      </span>
                    )}
                    {request.status === 'CANCELED' && (
                      <span className="flex items-center gap-1 text-gray-500 text-sm">
                        <XCircle className="h-4 w-4" /> Canceled
                      </span>
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


