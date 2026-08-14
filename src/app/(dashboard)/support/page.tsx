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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageSquare, Send, Clock, CheckCircle, AlertCircle, User, ArrowUp, ThumbsUp, ThumbsDown, AlertTriangle } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { toast } from 'sonner'
import { ticketStatusMeta } from '@/lib/status-metadata'

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
    const tone = ticketStatusMeta[status as keyof typeof ticketStatusMeta]?.tone ?? 'neutral'

    switch (status) {
      case 'OPEN':
        return <Badge variant={tone} className="gap-1"><Clock className="h-3 w-3" /> Open</Badge>
      case 'WAITING_ON_SUPERVISOR':
        return <Badge variant={tone} className="gap-1"><Clock className="h-3 w-3" /> Awaiting Supervisor</Badge>
      case 'WAITING_ON_STUDENT':
        return <Badge variant={tone} className="gap-1"><AlertCircle className="h-3 w-3" /> Supervisor Replied</Badge>
      case 'ESCALATED':
        return <Badge variant={tone} className="gap-1"><ArrowUp className="h-3 w-3" /> Escalated</Badge>
      case 'RESOLVED':
        return <Badge variant={tone} className="gap-1"><CheckCircle className="h-3 w-3" /> Resolved</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
            <div className="p-4 bg-surface-secondary rounded-lg">
              <p className="text-sm font-medium text-text-secondary mb-1">
                {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}
              </p>
              <p className="text-text-secondary">{selectedTicket.message}</p>
            </div>

            {selectedTicket.replies.map((reply) => (
              <div key={reply.id} className={`p-4 rounded-lg ${reply.author.role === 'ADMIN' || reply.author.role === 'SUB_ADMIN' ? 'bg-info-background' : 'bg-surface-secondary'}`}>
                <p className="text-sm font-medium text-text-secondary mb-1">
                  {reply.author.firstName} {reply.author.lastName}
                  <span className="text-text-muted font-normal ml-2">
                    {new Date(reply.createdAt).toLocaleString()}
                  </span>
                </p>
                <p className="text-text-secondary">{reply.message}</p>
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
              <Card className="bg-success-background border-success/30">
                <CardContent className="py-4">
                  <p className="font-medium text-foreground mb-3">Was this helpful?</p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-success/30 hover:bg-success-background"
                      onClick={() => handleFeedback(true)}
                    >
                      <ThumbsUp className="h-4 w-4 text-success" /> Yes
                    </Button>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 border-error/30 hover:bg-error-background"
                      onClick={() => handleFeedback(false)}
                    >
                      <ThumbsDown className="h-4 w-4 text-error" /> No
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedTicket.feedbackSubmittedAt && (
              <div className="text-center py-2 text-sm text-text-muted">
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
      <PageHeader
        title="Contact Supervisor"
        description="Get help from your supervisor with any questions or issues"
        actions={
          <Button onClick={() => setShowNewTicket(true)} disabled={!canOpenTicket}>
            <MessageSquare className="h-4 w-4 mr-2" /> New Ticket
          </Button>
        }
      />

      {supervisorInfo && (
        <Card className="bg-info-background border-info/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-background rounded-full">
                <User className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="font-medium text-foreground">Your Supervisor</p>
                <p className="text-sm text-text-secondary">
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
            <MessageSquare className="h-12 w-12 mx-auto text-text-muted mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Tickets Yet</h3>
            <p className="text-text-muted">Create a support ticket if you need help</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="cursor-pointer hover:border-info/30 transition-colors" onClick={() => setSelectedTicket(ticket)}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{ticket.subject}</p>
                    <p className="text-sm text-text-muted">
                      {ticket.category} - {new Date(ticket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {ticket.replies.length > 0 && (
                      <span className="text-sm text-text-muted">{ticket.replies.length} replies</span>
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
