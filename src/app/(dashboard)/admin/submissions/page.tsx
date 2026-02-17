'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Download, FileText, Send } from 'lucide-react'

interface Submission {
  id: string
  teamName: string
  teamDisplayId: string
  roundNumber: number
  marketName: string
  weekOffset: number
  occupancy: number
  adr: number
  submittedAt: string
  submitterName: string
  submitterEmail: string
  hasScore: boolean
  occupancyAE?: number
  adrAE?: number
}

export default function AdminSubmissionsPage() {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [totalSubmissions, setTotalSubmissions] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [exporting, setExporting] = useState(false)

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await csrfFetch(`/api/admin/submissions?page=${page}&pageSize=${pageSize}`)
      if (res.ok) {
        const data = await res.json()
        setSubmissions(data.submissions || [])
        setTotalSubmissions(data.totalSubmissions || 0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch submissions:', error)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await csrfFetch('/api/admin/submissions/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `submissions_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      }
    } catch (error) {
      clientLogger.error('Export failed:', error)
    } finally {
      setExporting(false)
    }
  }

  const columns = [
    {
      key: 'teamDisplayId',
      header: 'Team ID',
      sortable: true,
      render: (row: Submission) => (
        <span className="font-mono text-sm text-gray-600">{row.teamDisplayId}</span>
      ),
    },
    {
      key: 'teamName',
      header: 'Team',
      sortable: true,
      render: (row: Submission) => (
        <span className="font-medium">{row.teamName}</span>
      ),
    },
    {
      key: 'roundNumber',
      header: 'Round',
      sortable: true,
      render: (row: Submission) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
          R{row.roundNumber}
        </span>
      ),
    },
    {
      key: 'marketName',
      header: 'Market',
      sortable: true,
      render: (row: Submission) => row.marketName,
    },
    {
      key: 'weekOffset',
      header: 'Week',
      sortable: true,
      render: (row: Submission) => `W+${row.weekOffset}`,
    },
    {
      key: 'occupancy',
      header: 'Occupancy',
      sortable: true,
      render: (row: Submission) => (
        <div>
          <span className="font-medium">{row.occupancy.toFixed(1)}</span>
          {row.hasScore && row.occupancyAE !== undefined && (
            <span className="text-xs text-gray-500 ml-1">(AE: {row.occupancyAE.toFixed(2)})</span>
          )}
        </div>
      ),
    },
    {
      key: 'adr',
      header: 'ADR ($)',
      sortable: true,
      render: (row: Submission) => (
        <div>
          <span className="font-medium">${row.adr.toFixed(2)}</span>
          {row.hasScore && row.adrAE !== undefined && (
            <span className="text-xs text-gray-500 ml-1">(AE: {row.adrAE.toFixed(2)})</span>
          )}
        </div>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortable: true,
      render: (row: Submission) => (
        <div>
          <p className="text-sm">{new Date(row.submittedAt).toLocaleDateString()}</p>
          <p className="text-xs text-gray-500">{new Date(row.submittedAt).toLocaleTimeString()}</p>
        </div>
      ),
    },
    {
      key: 'submitterName',
      header: 'Submitter',
      sortable: true,
      render: (row: Submission) => (
        <div>
          <p className="text-sm font-medium">{row.submitterName}</p>
          <p className="text-xs text-gray-500">{row.submitterEmail}</p>
        </div>
      ),
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={10} columns={9} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const uniqueRounds = [...new Set(submissions.map(s => s.roundNumber))].sort((a, b) => a - b)
  const uniqueMarkets = [...new Set(submissions.map(s => s.marketName))]
  const totalPages = Math.max(1, Math.ceil(totalSubmissions / pageSize))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileText className="h-6 w-6 mr-2 text-blue-600" />
            Submissions Explorer
          </h1>
          <p className="text-gray-600">{totalSubmissions} total submissions</p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Submissions</p>
                <p className="text-3xl font-bold text-blue-600">{totalSubmissions}</p>
              </div>
              <Send className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unique Teams</p>
                <p className="text-3xl font-bold text-green-600">
                  {new Set(submissions.map(s => s.teamDisplayId)).size}
                </p>
              </div>
              <Send className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scored</p>
                <p className="text-3xl font-bold text-purple-600">
                  {submissions.filter(s => s.hasScore).length}
                </p>
              </div>
              <Send className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={submissions}
            columns={columns}
            searchKeys={['teamName', 'teamDisplayId', 'submitterName', 'submitterEmail']}
            searchPlaceholder="Search by team, ID, or submitter..."
            pageSize={20}
            filters={[
              {
                key: 'roundNumber',
                label: 'Round',
                options: uniqueRounds.map(r => ({ value: String(r), label: `Round ${r}` })),
              },
              {
                key: 'marketName',
                label: 'Market',
                options: uniqueMarkets.map(m => ({ value: m, label: m })),
              },
            ]}
          />
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

