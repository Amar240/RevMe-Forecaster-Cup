'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Download, FileText, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { AccessDenied } from '@/components/ui/access-denied'
import { usePermissions } from '@/hooks/usePermissions'

interface AuditLog {
  id: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

export default function AdminAuditLogsPage() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [exporting, setExporting] = useState(false)
  const [totalLogs, setTotalLogs] = useState(0)
  const { loading: permLoading, canPerform } = usePermissions()

  const fetchLogs = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/audit-logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotalLogs(data.totalLogs || 0)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch audit logs:', error)
      toast.error('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && canPerform('audit:view')) {
      fetchLogs()
    }
  }, [fetchLogs, permLoading, canPerform])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await csrfFetch('/api/admin/audit-logs/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      }
    } catch (error) {
      clientLogger.error('Export failed:', error)
      toast.error('Failed to export audit logs')
    } finally {
      setExporting(false)
    }
  }

  const getActionVariant = (action: string) => {
    if (action.includes('CREATE') || action.includes('ADD')) return 'success' as const
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'error' as const
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'info' as const
    if (action.includes('DISQUALIFY')) return 'warning' as const
    if (action.includes('REINSTATE')) return 'success' as const
    return 'neutral' as const
  }

  const columns = [
    {
      key: 'createdAt',
      header: 'Timestamp',
      sortable: true,
      render: (row: AuditLog) => (
        <div>
          <p className="text-sm font-medium">{new Date(row.createdAt).toLocaleDateString()}</p>
          <p className="text-xs text-text-muted">{new Date(row.createdAt).toLocaleTimeString()}</p>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (row: AuditLog) => (
        <Badge variant={getActionVariant(row.action)}>
          {row.action}
        </Badge>
      ),
    },
    {
      key: 'entityType',
      header: 'Entity Type',
      sortable: true,
      render: (row: AuditLog) => (
        <span className="text-sm text-text-secondary">{row.entityType}</span>
      ),
    },
    {
      key: 'entityId',
      header: 'Entity ID',
      render: (row: AuditLog) => (
        <span className="font-mono text-xs text-text-muted">{row.entityId || '-'}</span>
      ),
    },
    {
      key: 'userName',
      header: 'Performed By',
      sortable: true,
      render: (row: AuditLog) => (
        <div>
          <p className="text-sm font-medium">{row.userName || 'System'}</p>
          <p className="text-xs text-text-muted">{row.userEmail || '-'}</p>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (row: AuditLog) => (
        <span className="text-xs text-text-muted max-w-xs truncate block">
          {row.details ? JSON.stringify(row.details).substring(0, 50) + '...' : '-'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (row: AuditLog) => (
        <span className="font-mono text-xs text-text-muted">{row.ipAddress || '-'}</span>
      ),
    },
  ]

  if (permLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={10} columns={7} />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!canPerform('audit:view')) {
    return (
      <AccessDenied
        title="Access Denied"
        message="You do not have permission to view activity history."
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <TableSkeleton rows={10} columns={7} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const uniqueActions = [...new Set(logs.map(l => l.action))]
  const uniqueEntityTypes = [...new Set(logs.map(l => l.entityType))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center text-2xl font-semibold text-foreground">
            <Shield className="mr-2 h-6 w-6 text-primary" />
            Audit Logs
          </h1>
          <p className="text-text-secondary">{totalLogs} recorded actions</p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-50 to-white border-accent/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Total Logs</p>
                <p className="text-3xl font-bold text-accent">{totalLogs}</p>
              </div>
              <FileText className="h-8 w-8 text-accent" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-white border-info/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Today</p>
                <p className="text-3xl font-bold text-info">
                  {logs.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-white border-success/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-secondary">Unique Actions</p>
                <p className="text-3xl font-bold text-success">{uniqueActions.length}</p>
              </div>
              <FileText className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={logs}
            columns={columns}
            searchKeys={['action', 'entityType', 'userName', 'userEmail']}
            searchPlaceholder="Search logs..."
            pageSize={25}
            filters={[
              {
                key: 'action',
                label: 'Action',
                options: uniqueActions.map(a => ({ value: a, label: a })),
              },
              {
                key: 'entityType',
                label: 'Entity Type',
                options: uniqueEntityTypes.map(e => ({ value: e, label: e })),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
