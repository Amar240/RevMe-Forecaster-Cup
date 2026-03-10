'use client'

import { clientLogger } from '@/lib/client-logger'
import {
  createSupportTicket,
  getSupportTicket,
  getSupportTickets,
  getSupervisorInfo,
  replyToTicket,
  submitTicketFeedback,
} from '@/features/support/api'
import type { SupervisorInfo, TicketSummary } from '@/features/support/types'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageSquare, Send, Clock, CheckCircle, AlertCircle, User, ArrowUp, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { toast } from 'sonner'

export default function SupportPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showNewTicket, setShowNewTicket] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null)
  const [category, setCategory] = useState('GENERAL')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [replyMessage, setReplyMessage] = useState('')
  const [supervisorInfo, setSupervisorInfo] = useState<SupervisorInfo | null>(null)
  const canOpenTicket = Boolean(supervisorInfo?.email)

  useEffect(() => {
    fetchTickets()
    fetchSupervisorInfo()
  }, [])

  const fetchSupervisorInfo = async () => {
    try {
      const data = await getSupervisorInfo()
      setSupervisorInfo(data.supervisor)
    } catch (err) {
      clientLogger.error('Failed to fetch supervisor:', err)
      toast.error('Failed to load supervisor info')
    }
  }

  const fetchTickets = async () => {
    try {
      const data = await getSupportTickets()
      setTickets(data.tickets || [])
    } catch (err) {
      clientLogger.error('Failed to fetch tickets:', err)
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canOpenTicket) return
    setSubmitting(true)

    try {
      await createSupportTicket({ category, subject, message })
      setShowNewTicket(false)
      setSubject('')
      setMessage('')
      setCategory('GENERAL')
      fetchTickets()
    } catch (err) {
      clientLogger.error('Failed to create ticket:', err)
      toast.error('Failed to create support ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage) return

    try {
      await replyToTicket({ id: selectedTicket.id, message: replyMessage })
      setReplyMessage('')
      const data = await getSupportTicket(selectedTicket.id)
      setSelectedTicket(data.ticket)
      fetchTickets()
    } catch (err) {
      clientLogger.error('Failed to reply:', err)
      toast.error('Failed to send reply')
    }
  }

  const handleFeedback = async (rating: boolean) => {
    if (!selectedTicket) return

    try {
      await submitTicketFeedback({ id: selectedTicket.id, feedbackRating: rating })
      const data = await getSupportTicket(selectedTicket.id)
      setSelectedTicket(data.ticket)
      fetchTickets()
    } catch (err) {
      clientLogger.error('Failed to submit feedback:', err)
      toast.error('Failed to submit feedback')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="flex items-center gap-1 text-amber-600 text-sm"><Clock className="h-3 w-3" /> Open</span>
      case 'WAITING_ON_SUPERVISOR':
        return <span className="flex items-center gap-1 text-orange-600 text-sm"><Clock className="h-3 w-3" /> Awaiting Supervisor</span>
      case 'WAITING_ON_STUDENT':
        return <span className="flex items-center gap-1 text-blue-600 text-sm"><AlertCircle className="h-3 w-3" /> Supervisor Replied</span>
      case 'ESCALATED':
        return <span className="flex items-center gap-1 text-purple-600 text-sm"><ArrowUp className="h-3 w-3" /> Escalated</span>
      case 'RESOLVED':
        return <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle className="h-3 w-3" /> Resolved</span>
      default:
        return <span className="text-gray-500 text-sm">{status}</span>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (selectedTicket) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <Button variant="outline" onClick={() => setSelectedTicket(null)}>
          Back to Tickets
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedTicket.subject}</CardTitle>
              {getStatusBadge(selectedTicket.status)}
            </div>
            <CardDescription>
              {selectedTicket.category} - {new Date(selectedTicket.createdAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}
              </p>
              <p className="text-gray-600">{selectedTicket.message}</p>
            </div>

            {selectedTicket.replies.map((reply) => (
              <div key={reply.id} className={`p-4 rounded-lg ${reply.author.role === 'ADMIN' || reply.author.role === 'SUB_ADMIN' ? 'bg-blue-50' : 'bg-gray-50'}`}>
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {reply.author.firstName} {reply.author.lastName}
                  <span className="text-gray-400 font-normal ml-2">
                    {new Date(reply.createdAt).toLocaleString()}
                  </span>
                </p>
                <p className="text-gray-600">{reply.message}</p>
              </div>
            ))}

            {selectedTicket.status !== 'RESOLVED' && (
              <div className="flex gap-2">
                <Input
                  placeholder="Type your reply..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                />
                <Button onClick={handleReply} disabled={!replyMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}

            {selectedTicket.status === 'RESOLVED' && !selectedTicket.feedbackSubmittedAt && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="py-4">
                  <p className="font-medium text-gray-900 mb-3">Was this helpful?</p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-green-300 hover:bg-green-100"
                      onClick={() => handleFeedback(true)}
                    >
                      <ThumbsUp className="h-4 w-4 text-green-600" /> Yes
                    </Button>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-red-300 hover:bg-red-100"
                      onClick={() => handleFeedback(false)}
                    >
                      <ThumbsDown className="h-4 w-4 text-red-600" /> No
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedTicket.feedbackSubmittedAt && (
              <div className="text-center py-2 text-sm text-gray-500">
                Thank you for your feedback!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contact Supervisor</h1>
          <p className="text-gray-600">Get help from your supervisor with any questions or issues</p>
        </div>
        <Button onClick={() => setShowNewTicket(true)} disabled={!canOpenTicket}>
          <MessageSquare className="h-4 w-4 mr-2" /> New Ticket
        </Button>
      </div>

      {supervisorInfo && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <User className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Your Supervisor</p>
                <p className="text-sm text-gray-600">
                  {supervisorInfo.firstName} {supervisorInfo.lastName} ({supervisorInfo.email})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!supervisorInfo && (
        <AlertBanner variant="warning" title="No supervisor assigned yet">
          You need to be on a team before you can open a support ticket. Request to join a supervisor first.
        </AlertBanner>
      )}

      {showNewTicket && (
        <Card>
          <CardHeader>
            <CardTitle>Create Support Ticket</CardTitle>
            <CardDescription>
              Your ticket will be sent to {supervisorInfo ? `${supervisorInfo.firstName} ${supervisorInfo.lastName}` : 'your supervisor'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="LOGIN">Login Issues</SelectItem>
                    <SelectItem value="SUBMISSION">Submission</SelectItem>
                    <SelectItem value="SCORING">Scoring</SelectItem>
                    <SelectItem value="TEAM">Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  className="min-h-[100px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue in detail..."
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={submitting || !canOpenTicket}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Ticket'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Tickets Yet</h3>
            <p className="text-gray-500">Create a support ticket if you need help</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="cursor-pointer hover:border-blue-300 transition-colors" onClick={() => setSelectedTicket(ticket)}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{ticket.subject}</p>
                    <p className="text-sm text-gray-500">
                      {ticket.category} - {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {ticket.replies.length > 0 && (
                      <span className="text-sm text-gray-500">{ticket.replies.length} replies</span>
                    )}
                    {getStatusBadge(ticket.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

