'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ticketStatusMeta } from '@/lib/status-metadata'
import { 
  Loader2, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  ArrowUp,
  MessageSquare,
  User,
  Users,
  ArrowLeft,
  Eye,
  EyeOff,
  ChevronDown
} from 'lucide-react'

interface TicketReply {
  id: string
  message: string
  visibility: 'STUDENT_VISIBLE' | 'INTERNAL_ONLY'
  createdAt: string
  author: { firstName: string; lastName: string; role: string }
}

interface Ticket {
  id: string
  category: string
  subject: string
  message: string
  status: string
  createdAt: string
  createdBy: { firstName: string; lastName: string; email: string; role: string }
  team?: { id: string; name: string } | null
  assignedTo: { firstName: string; lastName: string } | null
  escalationReason?: string | null
  replies: TicketReply[]
}

interface CannedResponse {
  id: string
  title: string
  content: string
  category: string
}

export default function SupervisorSupportInboxPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [replyMessage, setReplyMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [escalationReason, setEscalationReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showCannedDropdown, setShowCannedDropdown] = useState(false)

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      let url = '/api/support-tickets?view=inbox'
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`
      }
      const res = await csrfFetch(url)
      if (res.ok) {
        const data = await res.json()
        let filteredTickets = data.tickets || []
        if (categoryFilter !== 'all') {
          filteredTickets = filteredTickets.filter((t: Ticket) => t.category === categoryFilter)
        }
        setTickets(filteredTickets)
      }
    } catch (err) {
      clientLogger.error('Failed to fetch tickets:', err)
      toast.error('Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter])

  const fetchCannedResponses = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/canned-responses')
      if (res.ok) {
        const data = await res.json()
        setCannedResponses(data.responses || [])
      }
    } catch (err) {
      clientLogger.error('Failed to fetch canned responses:', err)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
    fetchCannedResponses()
  }, [fetchTickets, fetchCannedResponses])

  const refreshTicket = async () => {
    if (!selectedTicket) return
    try {
      const res = await csrfFetch(`/api/support-tickets/${selectedTicket.id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedTicket(data.ticket)
        fetchTickets()
      }
    } catch (err) {
      clientLogger.error('Failed to refresh ticket:', err)
    }
  }

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return
    setSubmitting(true)

    try {
      const res = await csrfFetch(`/api/support-tickets/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reply', 
          message: replyMessage,
          isInternal: isInternalNote
        }),
      })

      if (res.ok) {
        setReplyMessage('')
        setIsInternalNote(false)
        await refreshTicket()
      }
    } catch (err) {
      clientLogger.error('Failed to reply:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async () => {
    if (!selectedTicket) return
    setSubmitting(true)

    try {
      const res = await csrfFetch(`/api/support-tickets/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      })

      if (res.ok) {
        await refreshTicket()
      }
    } catch (err) {
      clientLogger.error('Failed to resolve:', err)
      toast.error('Failed to resolve ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEscalate = async () => {
    if (!selectedTicket || !escalationReason.trim()) return
    setSubmitting(true)

    try {
      const res = await csrfFetch(`/api/support-tickets/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'escalate', escalationReason }),
      })

      if (res.ok) {
        setShowEscalateModal(false)
        setEscalationReason('')
        await refreshTicket()
      }
    } catch (err) {
      clientLogger.error('Failed to escalate:', err)
      toast.error('Failed to escalate ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const insertCannedResponse = (response: CannedResponse) => {
    setReplyMessage(prev => prev + (prev ? '\n\n' : '') + response.content)
    setShowCannedDropdown(false)
  }

  const getStatusBadge = (status: string) => {
    const tone = ticketStatusMeta[status as keyof typeof ticketStatusMeta]?.tone ?? 'neutral'

    switch (status) {
      case 'OPEN':
        return <Badge variant={tone} className="gap-1"><Clock className="h-3 w-3" /> Open</Badge>
      case 'WAITING_ON_SUPERVISOR':
        return <Badge variant={tone} className="gap-1"><AlertCircle className="h-3 w-3" /> Waiting on You</Badge>
      case 'WAITING_ON_STUDENT':
        return <Badge variant={tone} className="gap-1"><Clock className="h-3 w-3" /> Waiting on Student</Badge>
      case 'ESCALATED':
        return <Badge variant={tone} className="gap-1"><ArrowUp className="h-3 w-3" /> Escalated</Badge>
      case 'RESOLVED':
        return <Badge variant={tone} className="gap-1"><CheckCircle className="h-3 w-3" /> Resolved</Badge>
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  const getAge = (createdAt: string) => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffMs = now.getTime() - created.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'Just now'
  }

  const categories = ['GENERAL', 'LOGIN', 'SUBMISSION', 'SCORING', 'TEAM']

  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (selectedTicket) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setSelectedTicket(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Inbox
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{selectedTicket.subject}</CardTitle>
                <CardDescription className="mt-1">
                  <span className="inline-flex items-center gap-1 mr-3">
                    <User className="h-3 w-3" />
                    {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}
                  </span>
                  {selectedTicket.team && (
                    <span className="inline-flex items-center gap-1 mr-3">
                      <Users className="h-3 w-3" />
                      {selectedTicket.team.name}
                    </span>
                  )}
                  <span className="text-text-muted">{selectedTicket.category} • {getAge(selectedTicket.createdAt)}</span>
                </CardDescription>
              </div>
              {getStatusBadge(selectedTicket.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-surface-secondary rounded-lg border-l-4 border-border">
              <p className="text-sm font-medium text-text-secondary mb-1">
                {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}
                <span className="text-text-muted font-normal ml-2">
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </span>
              </p>
              <p className="text-text-secondary whitespace-pre-wrap">{selectedTicket.message}</p>
            </div>

            {selectedTicket.replies.map((reply) => {
              const isInternal = reply.visibility === 'INTERNAL_ONLY'
              const isStaff = reply.author.role === 'SUPERVISOR' || reply.author.role === 'ADMIN' || reply.author.role === 'SUB_ADMIN'
              
              return (
                <div 
                  key={reply.id} 
                  className={`p-4 rounded-lg border-l-4 ${
                    isInternal 
                      ? 'bg-warning-background border-warning/30' 
                      : isStaff 
                        ? 'bg-info-background border-info/30' 
                        : 'bg-surface-secondary border-border'
                  }`}
                >
                  <p className="text-sm font-medium text-text-secondary mb-1 flex items-center gap-2">
                    {reply.author.firstName} {reply.author.lastName}
                    {isInternal && (
                      <span className="inline-flex items-center gap-1 text-xs text-warning bg-warning-background px-2 py-0.5 rounded">
                        <EyeOff className="h-3 w-3" /> Internal Note
                      </span>
                    )}
                    <span className="text-text-muted font-normal">
                      {new Date(reply.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-text-secondary whitespace-pre-wrap">{reply.message}</p>
                </div>
              )
            })}

            {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'ESCALATED' && (
              <>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowCannedDropdown(!showCannedDropdown)}
                      >
                        Canned Responses <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                      {showCannedDropdown && cannedResponses.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                          {cannedResponses.map((response) => (
                            <button
                              key={response.id}
                              className="w-full text-left px-3 py-2 hover:bg-surface-secondary text-sm border-b last:border-b-0"
                              onClick={() => insertCannedResponse(response)}
                            >
                              <p className="font-medium text-foreground">{response.title}</p>
                              <p className="text-text-muted text-xs truncate">{response.content}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-text-secondary">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                        className="rounded border-border"
                      />
                      <EyeOff className="h-4 w-4" />
                      Internal note (hidden from student)
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      className="flex-1 min-h-[80px]"
                      placeholder={isInternalNote ? "Add an internal note..." : "Type your reply..."}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleReply} disabled={!replyMessage.trim() || submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                      {isInternalNote ? 'Add Note' : 'Send Reply'}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleResolve}
                    disabled={submitting}
                    className="text-success hover:bg-success-background"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Resolve
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowEscalateModal(true)}
                    disabled={submitting}
                    className="text-error hover:bg-error-background"
                  >
                    <ArrowUp className="h-4 w-4 mr-2" /> Escalate to Admin
                  </Button>
                </div>
              </>
            )}

            {selectedTicket.status === 'ESCALATED' && (
              <div className="border-t pt-4">
                <div className="p-4 bg-error-background rounded-lg">
                  <p className="text-sm font-medium text-error">This ticket has been escalated to admin.</p>
                  {selectedTicket.escalationReason && (
                    <p className="text-sm text-error mt-1">Reason: {selectedTicket.escalationReason}</p>
                  )}
                </div>
              </div>
            )}

            {selectedTicket.status === 'RESOLVED' && (
              <div className="border-t pt-4">
                <div className="p-4 bg-success-background rounded-lg">
                  <p className="text-sm font-medium text-success">This ticket has been resolved.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {showEscalateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Escalate to Admin</CardTitle>
                <CardDescription>Please provide a reason for escalating this ticket.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  className="min-h-[100px]"
                  placeholder="Why are you escalating this ticket?"
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => {
                    setShowEscalateModal(false)
                    setEscalationReason('')
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleEscalate}
                    disabled={!escalationReason.trim() || submitting}
                    className="bg-error hover:bg-error"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Escalate'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Support Inbox" description="Manage support tickets from your students" />

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="WAITING_ON_SUPERVISOR">Waiting on You</SelectItem>
              <SelectItem value="WAITING_ON_STUDENT">Waiting on Student</SelectItem>
              <SelectItem value="ESCALATED">Escalated</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat.charAt(0) + cat.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-text-muted mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Tickets</h3>
            <p className="text-text-muted">
              {statusFilter !== 'all' || categoryFilter !== 'all' 
                ? 'No tickets match your current filters' 
                : 'No support tickets from your students yet'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card 
              key={ticket.id} 
              className="cursor-pointer hover:border-info/30 transition-colors" 
              onClick={() => setSelectedTicket(ticket)}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted mt-1">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.createdBy.firstName} {ticket.createdBy.lastName}
                      </span>
                      {ticket.team && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ticket.team.name}
                        </span>
                      )}
                      <span className="px-2 py-0.5 bg-surface-secondary rounded text-xs">{ticket.category}</span>
                      <span className="text-text-muted">{getAge(ticket.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
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



