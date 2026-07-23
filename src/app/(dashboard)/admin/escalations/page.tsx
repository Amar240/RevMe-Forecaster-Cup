'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Loader2,
  Send,
  Clock,
  CheckCircle,
  ArrowUp,
  MessageSquare,
  User,
  Users,
  ArrowLeft,
  EyeOff,
  AlertTriangle,
  UserCog,
} from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Checkbox } from '@/components/ui/checkbox'
import { ticketStatusMeta } from '@/lib/status-metadata'

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
  escalatedAt?: string | null
  autoEscalatedAt?: string | null
  escalationReason?: string | null
  createdBy: { firstName: string; lastName: string; email: string; role: string }
  supervisor?: { firstName: string; lastName: string; email: string } | null
  escalatedBy?: { firstName: string; lastName: string } | null
  team?: { id: string; name: string } | null
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null
  replies: TicketReply[]
}

interface AdminUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
}

export default function AdminEscalationsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [replyMessage, setReplyMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedAssignee, setSelectedAssignee] = useState('')

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      let url = '/api/support-tickets?view=escalations'
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`
      }

      const res = await csrfFetch(url)
      if (res.ok) {
        const data = await res.json()
        let filteredTickets = data.tickets || []
        if (categoryFilter !== 'all') {
          filteredTickets = filteredTickets.filter((ticket: Ticket) => ticket.category === categoryFilter)
        }
        setTickets(filteredTickets)
      }
    } catch (err) {
      clientLogger.error('Failed to fetch tickets:', err)
      toast.error('Failed to load escalated tickets')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, statusFilter])

  const fetchAdminUsers = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        const admins = (data.users || []).filter(
          (user: AdminUser) => user.role === 'ADMIN' || user.role === 'SUB_ADMIN'
        )
        setAdminUsers(admins)
      }
    } catch (err) {
      clientLogger.error('Failed to fetch admin users:', err)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
    fetchAdminUsers()
  }, [fetchTickets, fetchAdminUsers])

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
          isInternal: isInternalNote,
        }),
      })

      if (res.ok) {
        setReplyMessage('')
        setIsInternalNote(false)
        await refreshTicket()
      }
    } catch (err) {
      clientLogger.error('Failed to reply:', err)
      toast.error('Failed to send reply')
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

  const handleAssign = async () => {
    if (!selectedTicket || !selectedAssignee) return
    setSubmitting(true)

    try {
      const res = await csrfFetch(`/api/support-tickets/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', assignedToId: selectedAssignee }),
      })

      if (res.ok) {
        setSelectedAssignee('')
        await refreshTicket()
      }
    } catch (err) {
      clientLogger.error('Failed to assign:', err)
      toast.error('Failed to assign ticket')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'ESCALATED') {
      return (
        <Badge variant={ticketStatusMeta.ESCALATED.tone} className="gap-1">
          <ArrowUp className="h-3 w-3" />
          {ticketStatusMeta.ESCALATED.label}
        </Badge>
      )
    }

    if (status === 'RESOLVED') {
      return (
        <Badge variant={ticketStatusMeta.RESOLVED.tone} className="gap-1">
          <CheckCircle className="h-3 w-3" />
          {ticketStatusMeta.RESOLVED.label}
        </Badge>
      )
    }

    return <Badge variant="neutral">{status}</Badge>
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

  const categories = ['GENERAL', 'LOGIN', 'SUBMISSION', 'SCORING', 'TEAM', 'PLATFORM', 'ONBOARDING']

  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-[180px]" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-[180px]" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (selectedTicket) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="outline" onClick={() => setSelectedTicket(null)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Escalations
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{selectedTicket.subject}</CardTitle>
                <CardDescription className="mt-1">
                  <span className="mr-3 inline-flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}
                  </span>
                  {selectedTicket.supervisor && (
                    <span className="mr-3 inline-flex items-center gap-1">
                      <UserCog className="h-3 w-3" />
                      Supervisor: {selectedTicket.supervisor.firstName} {selectedTicket.supervisor.lastName}
                    </span>
                  )}
                  {selectedTicket.team && (
                    <span className="mr-3 inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {selectedTicket.team.name}
                    </span>
                  )}
                  <span className="text-text-muted">{selectedTicket.category} - {getAge(selectedTicket.createdAt)}</span>
                </CardDescription>
              </div>
              {getStatusBadge(selectedTicket.status)}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {selectedTicket.escalationReason && (
              <AlertBanner variant="error" title="Escalation Reason">
                <p className="mt-1">{selectedTicket.escalationReason}</p>
                {selectedTicket.escalatedBy && (
                  <p className="mt-2 text-xs opacity-75">
                    Escalated by {selectedTicket.escalatedBy.firstName} {selectedTicket.escalatedBy.lastName}
                    {selectedTicket.escalatedAt && ` on ${new Date(selectedTicket.escalatedAt).toLocaleString()}`}
                  </p>
                )}
              </AlertBanner>
            )}

            {selectedTicket.autoEscalatedAt && (
              <AlertBanner
                variant="warning"
                title="Auto-Escalated"
                icon={<Clock className="mt-0.5 h-5 w-5 flex-shrink-0" />}
              >
                This ticket was automatically escalated on {new Date(selectedTicket.autoEscalatedAt).toLocaleString()} due to supervisor inactivity.
              </AlertBanner>
            )}

            {selectedTicket.assignedTo && (
              <AlertBanner variant="info">
                <span className="font-medium">Assigned to:</span> {selectedTicket.assignedTo.firstName} {selectedTicket.assignedTo.lastName} ({selectedTicket.assignedTo.email})
              </AlertBanner>
            )}

            <div className="rounded-lg border border-border border-l-4 border-l-border bg-surface-secondary p-4">
              <p className="mb-1 text-sm font-medium text-text-secondary">
                {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}
                <span className="ml-2 text-xs font-normal text-text-muted">({selectedTicket.createdBy.role})</span>
                <span className="ml-2 font-normal text-text-muted">
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </span>
              </p>
              <p className="whitespace-pre-wrap text-text-secondary">{selectedTicket.message}</p>
            </div>

            {selectedTicket.replies.map((reply) => {
              const isInternal = reply.visibility === 'INTERNAL_ONLY'
              const isStaff =
                reply.author.role === 'SUPERVISOR' ||
                reply.author.role === 'ADMIN' ||
                reply.author.role === 'SUB_ADMIN'

              const replyClassName = isInternal
                ? 'border border-warning/20 border-l-4 border-l-warning bg-warning-background/60'
                : isStaff
                  ? 'border border-info/20 border-l-4 border-l-info bg-info-background/60'
                  : 'border border-border border-l-4 border-l-border bg-surface-secondary'

              return (
                <div key={reply.id} className={`rounded-lg p-4 ${replyClassName}`}>
                  <p className="mb-1 flex items-center gap-2 text-sm font-medium text-text-secondary">
                    {reply.author.firstName} {reply.author.lastName}
                    <span className="text-xs text-text-muted">({reply.author.role})</span>
                    {isInternal && (
                      <Badge variant="warning" className="gap-1 px-2 py-0.5">
                        <EyeOff className="h-3 w-3" /> Internal Note
                      </Badge>
                    )}
                    <span className="font-normal text-text-muted">
                      {new Date(reply.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="whitespace-pre-wrap text-text-secondary">{reply.message}</p>
                </div>
              )
            })}

            {selectedTicket.status !== 'RESOLVED' ? (
              <>
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {adminUsers.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.firstName} {admin.lastName} ({admin.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={handleAssign} disabled={!selectedAssignee || submitting}>
                        Assign
                      </Button>
                    </div>
                    <Label className="flex cursor-pointer items-center gap-2 text-sm font-normal text-text-secondary">
                      <Checkbox
                        checked={isInternalNote}
                        onCheckedChange={(checked) => setIsInternalNote(checked === true)}
                      />
                      <EyeOff className="h-4 w-4" />
                      Internal note (hidden from student)
                    </Label>
                  </div>

                  <Textarea
                    className="min-h-[80px]"
                    placeholder={isInternalNote ? 'Add an internal note...' : 'Type your reply...'}
                    value={replyMessage}
                    onChange={(event) => setReplyMessage(event.target.value)}
                  />

                  <div className="flex gap-2">
                    <Button onClick={handleReply} disabled={!replyMessage.trim() || submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {isInternalNote ? 'Add Note' : 'Send Reply'}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    onClick={handleResolve}
                    disabled={submitting}
                    className="border-success/20 bg-success-background/60 text-success hover:bg-success-background"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" /> Resolve
                  </Button>
                </div>
              </>
            ) : (
              <div className="border-t border-border pt-4">
                <div className="rounded-lg bg-success-background p-4">
                  <p className="text-sm font-medium text-success">This ticket has been resolved.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Escalations</h1>
        <p className="text-text-secondary">Manage escalated support tickets requiring admin attention</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ESCALATED">Escalated</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0) + category.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto mb-4 h-12 w-12 text-text-muted" />
            <h3 className="mb-2 text-lg font-medium text-foreground">No Escalations</h3>
            <p className="text-text-secondary">
              {statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'No tickets match your current filters'
                : 'No escalated support tickets requiring your attention'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="cursor-pointer transition-colors hover:border-primary/30"
              onClick={() => setSelectedTicket(ticket)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{ticket.subject}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {ticket.createdBy.firstName} {ticket.createdBy.lastName}
                      </span>
                      {ticket.supervisor && (
                        <span className="inline-flex items-center gap-1">
                          <UserCog className="h-3 w-3" />
                          {ticket.supervisor.firstName} {ticket.supervisor.lastName}
                        </span>
                      )}
                      {ticket.team && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ticket.team.name}
                        </span>
                      )}
                      <Badge variant="neutral">{ticket.category}</Badge>
                      <span className="text-text-muted">{getAge(ticket.createdAt)}</span>
                    </div>

                    {ticket.escalationReason && (
                      <p className="mt-2 flex items-center gap-1 text-sm text-error">
                        <AlertTriangle className="h-3 w-3" />
                        {ticket.escalationReason.length > 80
                          ? `${ticket.escalationReason.slice(0, 80)}...`
                          : ticket.escalationReason}
                      </p>
                    )}

                    {ticket.autoEscalatedAt && !ticket.escalationReason && (
                      <p className="mt-2 flex items-center gap-1 text-sm text-warning">
                        <Clock className="h-3 w-3" />
                        Auto-escalated on {new Date(ticket.autoEscalatedAt).toLocaleDateString()}
                      </p>
                    )}
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
