'use client'

import { useState, useEffect } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Send, Clock, Bell, AlertTriangle, Mail, History } from 'lucide-react'

const emailTypes = [
  { value: 'round_reminder', label: 'Round Reminder', description: 'Remind teams about upcoming deadline', icon: Clock },
  { value: 'results_published', label: 'Results Published', description: 'Notify participants about new scores', icon: Bell },
  { value: 'missed_submission', label: 'Missed Submission', description: 'Warn teams that missed the deadline', icon: AlertTriangle },
  { value: 'custom_announcement', label: 'Custom Announcement', description: 'Send a custom message', icon: Mail },
]

const recipientFilters = [
  { value: 'all', label: 'All Participants' },
  { value: 'students', label: 'Students Only' },
  { value: 'supervisors', label: 'Supervisors Only' },
  { value: 'missing_submissions', label: 'Teams with Missing Submissions' },
]

interface NotificationHistory {
  id: string
  type: string
  title: string
  message: string
  createdAt: string
}

export default function AdminCommunicationsPage() {
  const [selectedType, setSelectedType] = useState('round_reminder')
  const [recipientFilter, setRecipientFilter] = useState('all')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<NotificationHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const res = await csrfFetch('/api/admin/communications')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.notifications || [])
      }
    } catch (error) {
      clientLogger.error('Failed to fetch history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const res = await csrfFetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          subject: subject || undefined,
          body: body || undefined,
          recipientFilter,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `Sent to ${data.sent} recipients`)
        setSubject('')
        setBody('')
        fetchHistory()
      } else {
        toast.error(data.message || 'Failed to send')
      }
    } catch (error) {
      clientLogger.error('Failed to send:', error)
      toast.error('Failed to send communications')
    } finally {
      setSending(false)
    }
  }

  const selectedTypeInfo = emailTypes.find(t => t.value === selectedType)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Communications</h1>
        <p className="text-gray-500 mt-1">Send emails and notifications to participants</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Send Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-600" />
                Send Communication
              </CardTitle>
              <CardDescription>Choose a template or write a custom message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selection */}
              <div className="grid grid-cols-2 gap-3">
                {emailTypes.map(type => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      onClick={() => setSelectedType(type.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedType === type.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <p className="text-sm font-medium">{type.label}</p>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </button>
                  )
                })}
              </div>

              {/* Recipient Filter */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Recipients</label>
                <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recipientFilters.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom subject/body for custom announcements */}
              {selectedType === 'custom_announcement' && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Subject</label>
                    <Input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      placeholder="Email subject line"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">Message</label>
                    <Textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      placeholder="Write your message here..."
                      rows={6}
                    />
                  </div>
                </>
              )}

              <Button onClick={handleSend} disabled={sending || (selectedType === 'custom_announcement' && !body)} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Sending...' : `Send ${selectedTypeInfo?.label}`}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* History Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-gray-500" />
                Recent Sends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-500">No notifications sent yet</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {history.map(item => (
                    <div key={item.id} className="border-b last:border-0 pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{item.type.replace(/_/g, ' ')}</Badge>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mt-1">{item.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
