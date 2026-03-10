'use client'

import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Download, FileText, Send, LayoutGrid, List, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'

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

interface PendingTeam {
  id: string
  teamName: string
  teamDisplayId: string
  universityName: string
  supervisorName: string
  supervisorEmail: string
  warningsCount: number
  lastSubmissionAt?: string | null
}

type ViewStyle = 'flat' | 'comparison'
type SortField = 'team' | 'round'
type SortDir = 'asc' | 'desc'

interface PivotRow {
  teamName: string
  teamDisplayId: string
  roundNumber: number
  submittedAt: string
  submitterName: string
  cells: Record<string, { occupancy: number; adr: number; occupancyAE?: number; adrAE?: number; hasScore: boolean }>
}

export default function AdminSubmissionsPage() {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([])
  const [totalSubmissions, setTotalSubmissions] = useState(0)
  const [scoredSubmissionsCount, setScoredSubmissionsCount] = useState(0)
  const [uniqueTeamsCount, setUniqueTeamsCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [viewMode, setViewMode] = useState<'all' | 'pending'>('all')
  const [viewStyle, setViewStyle] = useState<ViewStyle>('flat')
  const [exporting, setExporting] = useState(false)
  const [pivotSortField, setPivotSortField] = useState<SortField>('team')
  const [pivotSortDir, setPivotSortDir] = useState<SortDir>('asc')

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/submissions')
      if (res.ok) {
        const data = await res.json()
        setSubmissions(data.submissions || [])
        setTotalSubmissions(data.totalSubmissions || 0)
        setScoredSubmissionsCount(data.scoredSubmissionsCount || 0)
        setUniqueTeamsCount(data.uniqueTeamsCount || 0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch submissions:', error)
      toast.error('Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubmissions()
  }, [fetchSubmissions])

  const fetchPendingTeams = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/submissions/pending')
      if (res.ok) {
        const data = await res.json()
        setPendingTeams(data.pendingTeams || [])
        setPendingCount(data.pendingCount || 0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch pending teams:', error)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'pending') {
      fetchPendingTeams()
    }
  }, [viewMode, fetchPendingTeams])

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
      toast.error('Failed to export submissions')
    } finally {
      setExporting(false)
    }
  }

  // --- Pivot logic ---
  const pivotColumnKeys = useMemo(() => {
    const keys: { key: string; marketName: string; weekOffset: number }[] = []
    const marketNames = [...new Set(submissions.map(s => s.marketName))].sort()
    const weekOffsets = [...new Set(submissions.map(s => s.weekOffset))].sort((a, b) => a - b)
    for (const mn of marketNames) {
      for (const wo of weekOffsets) {
        keys.push({ key: `${mn}_W${wo}`, marketName: mn, weekOffset: wo })
      }
    }
    return keys
  }, [submissions])

  const pivotRows = useMemo(() => {
    const grouped = new Map<string, PivotRow>()
    for (const sub of submissions) {
      const rowKey = `${sub.teamDisplayId}__R${sub.roundNumber}`
      if (!grouped.has(rowKey)) {
        grouped.set(rowKey, {
          teamName: sub.teamName,
          teamDisplayId: sub.teamDisplayId,
          roundNumber: sub.roundNumber,
          submittedAt: sub.submittedAt,
          submitterName: sub.submitterName,
          cells: {},
        })
      }
      const row = grouped.get(rowKey)!
      const cellKey = `${sub.marketName}_W${sub.weekOffset}`
      row.cells[cellKey] = {
        occupancy: sub.occupancy,
        adr: sub.adr,
        occupancyAE: sub.occupancyAE,
        adrAE: sub.adrAE,
        hasScore: sub.hasScore,
      }
    }
    const rows = Array.from(grouped.values())
    rows.sort((a, b) => {
      const dir = pivotSortDir === 'asc' ? 1 : -1
      if (pivotSortField === 'round') return dir * (a.roundNumber - b.roundNumber)
      return dir * a.teamName.localeCompare(b.teamName)
    })
    return rows
  }, [submissions, pivotSortField, pivotSortDir])

  const togglePivotSort = (field: SortField) => {
    if (pivotSortField === field) {
      setPivotSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setPivotSortField(field)
      setPivotSortDir('asc')
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

  const pendingColumns = [
    {
      key: 'teamDisplayId',
      header: 'Team ID',
      sortable: true,
      render: (row: PendingTeam) => (
        <span className="font-mono text-sm text-gray-600">{row.teamDisplayId}</span>
      ),
    },
    {
      key: 'teamName',
      header: 'Team',
      sortable: true,
      render: (row: PendingTeam) => (
        <span className="font-medium">{row.teamName}</span>
      ),
    },
    {
      key: 'universityName',
      header: 'University',
      sortable: true,
      render: (row: PendingTeam) => row.universityName,
    },
    {
      key: 'supervisorName',
      header: 'Supervisor',
      sortable: true,
      render: (row: PendingTeam) => (
        <div>
          <p className="text-sm font-medium">{row.supervisorName}</p>
          <p className="text-xs text-gray-500">{row.supervisorEmail}</p>
        </div>
      ),
    },
    {
      key: 'warningsCount',
      header: 'Warnings',
      sortable: true,
      render: (row: PendingTeam) => (
        <span className="text-sm font-medium">{row.warningsCount}</span>
      ),
    },
    {
      key: 'lastSubmissionAt',
      header: 'Last Submission',
      sortable: true,
      render: (row: PendingTeam) => (
        row.lastSubmissionAt ? (
          <div>
            <p className="text-sm">{new Date(row.lastSubmissionAt).toLocaleDateString()}</p>
            <p className="text-xs text-gray-500">{new Date(row.lastSubmissionAt).toLocaleTimeString()}</p>
          </div>
        ) : (
          <span className="text-sm text-gray-500">Not set</span>
        )
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
            <FileText className="h-6 w-6 mr-2 text-blue-600" />
            Submissions Explorer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{totalSubmissions} total submissions</p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={viewMode === 'all' ? 'default' : 'outline'}
            onClick={() => setViewMode('all')}
          >
            All Submissions
          </Button>
          <Button
            variant={viewMode === 'pending' ? 'default' : 'outline'}
            onClick={() => setViewMode('pending')}
          >
            Pending Submissions {pendingCount > 0 ? `(${pendingCount})` : ''}
          </Button>
        </div>
        {viewMode === 'all' && (
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewStyle('flat')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewStyle === 'flat'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
              <span>Flat</span>
            </button>
            <button
              onClick={() => setViewStyle('comparison')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewStyle === 'comparison'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Comparison</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 dark:from-blue-950/30 dark:to-gray-900 dark:border-blue-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Submissions</p>
                <p className="text-3xl font-bold text-blue-600">{totalSubmissions}</p>
              </div>
              <Send className="h-8 w-8 text-blue-200 dark:text-blue-800" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 dark:from-green-950/30 dark:to-gray-900 dark:border-green-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unique Teams</p>
                <p className="text-3xl font-bold text-green-600">{uniqueTeamsCount}</p>
              </div>
              <Send className="h-8 w-8 text-green-200 dark:text-green-800" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 dark:from-purple-950/30 dark:to-gray-900 dark:border-purple-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Scored</p>
                <p className="text-3xl font-bold text-purple-600">{scoredSubmissionsCount}</p>
              </div>
              <Send className="h-8 w-8 text-purple-200 dark:text-purple-800" />
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === 'pending' ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={pendingTeams}
              columns={pendingColumns}
              searchKeys={['teamName', 'teamDisplayId', 'universityName', 'supervisorName', 'supervisorEmail']}
              searchPlaceholder="Search by team, university, or supervisor..."
              pageSize={20}
            />
          </CardContent>
        </Card>
      ) : viewStyle === 'comparison' ? (
        /* ========= COMPARISON / PIVOT VIEW ========= */
        <Card>
          <CardHeader>
            <CardTitle>Submissions Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
                    <th
                      className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => togglePivotSort('team')}
                    >
                      <span className="flex items-center space-x-1">
                        <span>Team</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    <th
                      className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none whitespace-nowrap"
                      onClick={() => togglePivotSort('round')}
                    >
                      <span className="flex items-center space-x-1">
                        <span>Round</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </span>
                    </th>
                    {pivotColumnKeys.map((col) => (
                      <th
                        key={`${col.key}_occ`}
                        className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[90px]"
                      >
                        <div className="text-xs leading-tight">
                          <div>{col.marketName}</div>
                          <div className="text-gray-400 dark:text-gray-500">Occ W+{col.weekOffset}</div>
                        </div>
                      </th>
                    ))}
                    {pivotColumnKeys.map((col) => (
                      <th
                        key={`${col.key}_adr`}
                        className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[90px]"
                      >
                        <div className="text-xs leading-tight">
                          <div>{col.marketName}</div>
                          <div className="text-gray-400 dark:text-gray-500">ADR W+{col.weekOffset}</div>
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Submitted</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Submitter</th>
                  </tr>
                </thead>
                <tbody>
                  {pivotRows.map((row) => (
                    <tr key={`${row.teamDisplayId}-R${row.roundNumber}`} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900 z-10 whitespace-nowrap">
                        {row.teamName}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                          R{row.roundNumber}
                        </span>
                      </td>
                      {pivotColumnKeys.map((col) => {
                        const cell = row.cells[col.key]
                        if (!cell) {
                          return (
                            <td key={`${col.key}_occ`} className="px-2 py-2.5 text-center text-gray-300 dark:text-gray-600">--</td>
                          )
                        }
                        return (
                          <td key={`${col.key}_occ`} className="px-2 py-2.5 text-center font-mono text-xs">
                            <span className="font-medium">{cell.occupancy.toFixed(1)}</span>
                            {cell.hasScore && cell.occupancyAE !== undefined && (
                              <span className="text-gray-400 ml-0.5">({cell.occupancyAE.toFixed(1)})</span>
                            )}
                          </td>
                        )
                      })}
                      {pivotColumnKeys.map((col) => {
                        const cell = row.cells[col.key]
                        if (!cell) {
                          return (
                            <td key={`${col.key}_adr`} className="px-2 py-2.5 text-center text-gray-300 dark:text-gray-600">--</td>
                          )
                        }
                        return (
                          <td key={`${col.key}_adr`} className="px-2 py-2.5 text-center font-mono text-xs">
                            <span className="font-medium">${cell.adr.toFixed(0)}</span>
                            {cell.hasScore && cell.adrAE !== undefined && (
                              <span className="text-gray-400 ml-0.5">({cell.adrAE.toFixed(1)})</span>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                        {new Date(row.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                        {row.submitterName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ========= FLAT VIEW ========= */
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
              pageSize={25}
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
