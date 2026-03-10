'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Eye,
  EyeOff,
  AlertTriangle,
  UserCog
} from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Checkbox } from '@/components/ui/checkbox'

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
          filteredTickets = filteredTickets.filter((t: Ticket) => t.category === categoryFilter)
        }
        setTickets(filteredTickets)
      }
    } catch (err) {
      clientLogger.error('Failed to fetch tickets:', err)
      toast.error('Failed to load escalated tickets')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter])

  const fetchAdminUsers = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        const admins = (data.users || []).filter(
          (u: AdminUser) => u.role === 'ADMIN' || u.role === 'SUB_ADMIN'
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
    switch (status) {
      case 'ESCALATED':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><ArrowUp className="h-3 w-3" /> Escalated</span>
      case 'RESOLVED':
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="h-3 w-3" /> Resolved</span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>
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

  const categories = ['GENERAL', 'LOGIN', 'SUBMISSION', 'SCORING', 'TEAM', 'PLATFORM', 'ONBOARDING']

  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 bg-gray-200 rounded w-40" />
          <div className="h-4 bg-gray-100 rounded w-72" />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <div className="h-4 bg-gray-100 rounded w-12" />
            <div className="h-10 bg-gray-200 rounded w-[180px]" />
          </div>
          <div className="space-y-1">
            <div className="h-4 bg-gray-100 rounded w-16" />
            <div className="h-10 bg-gray-200 rounded w-[180px]" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="flex gap-2">
                    <div className="h-4 bg-gray-100 rounded w-24" />
                    <div className="h-4 bg-gray-100 rounded w-20" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                  </div>
                </div>
                <div className="h-6 bg-gray-200 rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (selectedTicket) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="outline" onClick={() => setSelectedTicket(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Escalations
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
                  {selectedTicket.supervisor && (
                    <span className="inline-flex items-center gap-1 mr-3">
                      <UserCog className="h-3 w-3" />
                      Supervisor: {selectedTicket.supervisor.firstName} {selectedTicket.supervisor.lastName}
                    </span>
                  )}
                  {selectedTicket.team && (
                    <span className="inline-flex items-center gap-1 mr-3">
                      <Users className="h-3 w-3" />
                      {selectedTicket.team.name}
                    </span>
                  )}
                  <span className="text-gray-400">{selectedTicket.category} • {getAge(selectedTicket.createdAt)}</span>
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
                  <p className="text-xs opacity-75 mt-2">
                    Escalated by {selectedTicket.escalatedBy.firstName} {selectedTicket.escalatedBy.lastName}
                    {selectedTicket.escalatedAt && ` on ${new Date(selectedTicket.escalatedAt).toLocaleString()}`}
                  </p>
                )}
              </AlertBanner>
            )}

            {selectedTicket.autoEscalatedAt && (
              <AlertBanner variant="warning" title="Auto-Escalated" icon={<Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />}>
                This ticket was automatically escalated on {new Date(selectedTicket.autoEscalatedAt).toLocaleString()} due to supervisor inactivity.
              </AlertBanner>
            )}

            {selectedTicket.assignedTo && (
              <AlertBanner variant="info">
                <span className="font-medium">Assigned to:</span> {selectedTicket.assignedTo.firstName} {selectedTicket.assignedTo.lastName} ({selectedTicket.assignedTo.email})
              </AlertBanner>
            )}

            <div className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-300">
              <p className="text-sm font-medium text-gray-700 mb-1">
                {selectedTicket.createdBy.firstName} {selectedTicket.createdBy.lastName}
                <span className="text-xs text-gray-400 font-normal ml-2">
                  ({selectedTicket.createdBy.role})
                </span>
                <span className="text-gray-400 font-normal ml-2">
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </span>
              </p>
              <p className="text-gray-600 whitespace-pre-wrap">{selectedTicket.message}</p>
            </div>

            {selectedTicket.replies.map((reply) => {
              const isInternal = reply.visibility === 'INTERNAL_ONLY'
              const isStaff = reply.author.role === 'SUPERVISOR' || reply.author.role === 'ADMIN' || reply.author.role === 'SUB_ADMIN'
              
              return (
                <div 
                  key={reply.id} 
                  className={`p-4 rounded-lg border-l-4 ${
                    isInternal 
                      ? 'bg-yellow-50 border-yellow-400' 
                      : isStaff 
                        ? 'bg-blue-50 border-blue-400' 
                        : 'bg-gray-50 border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    {reply.author.firstName} {reply.author.lastName}
                    <span className="text-xs text-gray-400">({reply.author.role})</span>
                    {isInternal && (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                        <EyeOff className="h-3 w-3" /> Internal Note
                      </span>
                    )}
                    <span className="text-gray-400 font-normal">
                      {new Date(reply.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-gray-600 whitespace-pre-wrap">{reply.message}</p>
                </div>
              )
            })}

            {selectedTicket.status !== 'RESOLVED' && (
              <>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="Assign to..." /></SelectTrigger>
                        <SelectContent>
                          {adminUsers.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.firstName} {admin.lastName} ({admin.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleAssign}
                        disabled={!selectedAssignee || submitting}
                      >
                        Assign
                      </Button>
                    </div>
                    <Label className="flex items-center gap-2 text-sm font-normal text-gray-600 cursor-pointer">
                      <Checkbox
                        checked={isInternalNote}
                        onCheckedChange={(checked) => setIsInternalNote(checked === true)}
                      />
                      <EyeOff className="h-4 w-4" />
                      Internal note (hidden from student)
                    </Label>
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
                    className="text-green-600 hover:bg-green-50"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Resolve
                  </Button>
                </div>
              </>
            )}

            {selectedTicket.status === 'RESOLVED' && (
              <div className="border-t pt-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm font-medium text-green-700">This ticket has been resolved.</p>
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
        <h1 className="text-2xl font-bold text-gray-900">Escalations</h1>
        <p className="text-gray-600">Manage escalated support tickets requiring admin attention</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
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
            <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Escalations</h3>
            <p className="text-gray-500">
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
              className="cursor-pointer hover:border-blue-300 transition-colors" 
              onClick={() => setSelectedTicket(ticket)}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{ticket.subject}</p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
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
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{ticket.category}</span>
                      <span className="text-gray-400">{getAge(ticket.createdAt)}</span>
                    </div>
                    {ticket.escalationReason && (
                      <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {ticket.escalationReason.length > 80 
                          ? ticket.escalationReason.slice(0, 80) + '...' 
                          : ticket.escalationReason}
                      </p>
                    )}
                    {ticket.autoEscalatedAt && !ticket.escalationReason && (
                      <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Auto-escalated on {new Date(ticket.autoEscalatedAt).toLocaleDateString()}
                      </p>
                    )}
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




