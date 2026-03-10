'use client'

import { useEffect, useState } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type DemoRequest = {
  id: string
  name: string
  email: string
  organization?: string | null
  message?: string | null
  status: 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'CLOSED'
  createdAt: string
}

const statusOptions: DemoRequest['status'][] = ['NEW', 'CONTACTED', 'SCHEDULED', 'CLOSED']

export default function DemoRequestsPage() {
  const [requests, setRequests] = useState<DemoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await csrfFetch('/api/admin/demo-requests')
      const data = await response.json()
      setRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch {
      setError('Unable to load demo requests.')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: DemoRequest['status']) => {
    try {
      const response = await csrfFetch('/api/admin/demo-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (response.ok) {
        setRequests((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status } : item))
        )
      }
    } catch {
      // keep UI stable on failure
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demo Requests</h1>
          <p className="text-sm text-gray-500">Track inbound demo inquiries from universities.</p>
        </div>
        <Button variant="outline" onClick={loadRequests}>
          Refresh
        </Button>
      </div>

      {error && (
        <AlertBanner variant="error">{error}</AlertBanner>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-gray-100 rounded w-full max-w-sm" />
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b px-4 py-3 flex gap-4">
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-4 bg-gray-200 rounded w-1/5" />
              <div className="h-4 bg-gray-200 rounded w-1/5" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b last:border-0 flex gap-4">
                <div className="h-4 bg-gray-100 rounded w-1/4" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-4 bg-gray-100 rounded w-1/5" />
                <div className="h-4 bg-gray-100 rounded-full w-20" />
                <div className="h-4 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <DataTable
          data={requests}
          columns={[
            { key: 'name', header: 'Name', sortable: true },
            { key: 'email', header: 'Email', sortable: true },
            {
              key: 'organization',
              header: 'Organization',
              sortable: true,
              render: (r: DemoRequest) => r.organization || '—',
            },
            {
              key: 'status',
              header: 'Status',
              render: (r: DemoRequest) => (
                <Select value={r.status} onValueChange={(val) => updateStatus(r.id, val as DemoRequest['status'])}>
                  <SelectTrigger className={`h-7 w-[120px] rounded-full px-3 text-xs font-medium border-0 ${
                    r.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                    r.status === 'CONTACTED' ? 'bg-yellow-100 text-yellow-700' :
                    r.status === 'SCHEDULED' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ),
            },
            {
              key: 'createdAt',
              header: 'Date',
              sortable: true,
              render: (r: DemoRequest) => (
                <span className="text-sm text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              ),
            },
          ]}
          searchKeys={['name', 'email', 'organization']}
          searchPlaceholder="Search demo requests..."
          pageSize={10}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'NEW', label: 'New' },
                { value: 'CONTACTED', label: 'Contacted' },
                { value: 'SCHEDULED', label: 'Scheduled' },
                { value: 'CLOSED', label: 'Closed' },
              ],
            },
          ]}
        />
      )}
    </div>
  )
}
