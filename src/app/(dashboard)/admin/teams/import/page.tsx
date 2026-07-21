'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type {
  TeamImportConfirmResult,
  TeamImportPersonSummary,
  TeamImportPreviewRow,
  TeamImportPreviewSummary,
  TeamImportResultRow,
} from '@/lib/team-import/types'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/ui/access-denied'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageLoader } from '@/components/ui/page-loader'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ImportSeasonOption {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
}

interface PreviewResponse {
  batchId: string
  fileName: string
  season: {
    id: string
    name: string
    status: string
  }
  summary: TeamImportPreviewSummary
  rows: TeamImportPreviewRow[]
}

function renderPersonSummary(person: TeamImportPersonSummary) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-foreground">{person.displayName}</p>
      {person.nameMismatch && person.uploadedName && person.matchedName ? (
        <div className="text-xs text-warning">
          <p>Uploaded: {person.uploadedName}</p>
          <p>Matched: {person.matchedName}</p>
        </div>
      ) : null}
    </div>
  )
}

function renderMemberList(members: TeamImportPersonSummary[]) {
  if (members.length === 0) {
    return <span className="text-text-muted">-</span>
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member.email || member.displayName}>{renderPersonSummary(member)}</div>
      ))}
    </div>
  )
}

export default function AdminTeamsImportPage() {
  const { loading: permLoading, isAdmin, hasFullAccess } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [seasons, setSeasons] = useState<ImportSeasonOption[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<TeamImportConfirmResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const hasRosterAccess = isAdmin || hasFullAccess
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId) ?? null

  const fetchOptions = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/teams/import/options')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load seasons')
      }

      setSeasons(data.seasons || [])
      setSelectedSeasonId((current) => current || data.seasons?.[0]?.id || '')
    } catch (error) {
      clientLogger.error('Failed to load team import options:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load import options')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && hasRosterAccess) {
      void fetchOptions()
    }
  }, [fetchOptions, hasRosterAccess, permLoading])

  const handlePreview = async () => {
    if (!selectedSeasonId) {
      toast.error('Select a season before previewing the file')
      return
    }

    if (!selectedFile) {
      toast.error('Choose a .csv or .xlsx file to preview')
      return
    }

    setPreviewLoading(true)
    setErrorMessage('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('seasonId', selectedSeasonId)
      formData.append('file', selectedFile)

      const res = await csrfFetch('/api/admin/teams/import/preview', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to preview import file')
      }

      setPreview(data)
      toast.success(
        `Preview ready: ${data.summary.validRows} valid, ${data.summary.invalidRows} invalid, ${data.summary.rowsWithWarnings} with warnings`
      )
    } catch (error) {
      clientLogger.error('Failed to preview team import:', error)
      setPreview(null)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to preview import file')
      toast.error(error instanceof Error ? error.message : 'Failed to preview import file')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedSeasonId || !selectedFile) {
      toast.error('Season and file are required to confirm the import')
      return
    }

    setConfirmLoading(true)
    setErrorMessage('')

    try {
      const formData = new FormData()
      formData.append('seasonId', selectedSeasonId)
      formData.append('file', selectedFile)
      if (preview?.batchId) formData.append('batchId', preview.batchId)

      const res = await csrfFetch('/api/admin/teams/import/confirm', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Failed to confirm import')
      }

      setResult(data)
      toast.success(`Imported ${data.summary.teamsCreated} team${data.summary.teamsCreated === 1 ? '' : 's'}`)
    } catch (error) {
      clientLogger.error('Failed to confirm team import:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to confirm import')
      toast.error(error instanceof Error ? error.message : 'Failed to confirm import')
    } finally {
      setConfirmLoading(false)
    }
  }

  const previewColumns = useMemo(
    () => [
      {
        key: 'rowNumber',
        header: 'Row',
        sortable: true,
      },
      {
        key: 'teamExternalId',
        header: 'Team Identifier',
        sortable: true,
      },
      {
        key: 'universityName',
        header: 'University',
        sortable: true,
      },
      {
        key: 'teamName',
        header: 'Team Name',
        sortable: true,
      },
      {
        key: 'supervisorLabel',
        header: 'Supervisor',
        render: (row: TeamImportPreviewRow) => row.supervisorLabel || row.supervisorEmail || '-',
      },
      {
        key: 'submitter.displayName',
        header: 'Submitter',
        render: (row: TeamImportPreviewRow) => renderPersonSummary(row.submitter),
      },
      {
        key: 'members',
        header: 'Members',
        render: (row: TeamImportPreviewRow) => renderMemberList(row.members),
      },
      {
        key: 'memberCount',
        header: 'Count',
        sortable: true,
        className: 'text-center',
      },
      {
        key: 'status',
        header: 'Status',
        render: (row: TeamImportPreviewRow) => (
          <Badge variant={row.valid ? 'success' : 'error'}>
            {row.valid ? 'Valid' : 'Invalid'}
          </Badge>
        ),
      },
      {
        key: 'warnings',
        header: 'Warnings',
        render: (row: TeamImportPreviewRow) => row.warnings.join('; ') || '-',
      },
      {
        key: 'errors',
        header: 'Error',
        render: (row: TeamImportPreviewRow) => row.errors.join('; ') || '-',
      },
    ],
    []
  )

  const resultColumns = useMemo(
    () => [
      {
        key: 'rowNumber',
        header: 'Row',
        sortable: true,
      },
      {
        key: 'teamExternalId',
        header: 'Team Identifier',
        sortable: true,
      },
      {
        key: 'teamName',
        header: 'Team Name',
        sortable: true,
      },
      {
        key: 'submitter.displayName',
        header: 'Submitter',
        render: (row: TeamImportResultRow) => renderPersonSummary(row.submitter),
      },
      {
        key: 'members',
        header: 'Members',
        render: (row: TeamImportResultRow) => renderMemberList(row.members),
      },
      {
        key: 'memberCount',
        header: 'Count',
        sortable: true,
      },
      {
        key: 'status',
        header: 'Result',
        render: (row: TeamImportResultRow) => (
          <Badge variant={row.status === 'created' ? 'success' : 'warning'}>
            {row.status === 'created' ? 'Created' : 'Skipped'}
          </Badge>
        ),
      },
      {
        key: 'warnings',
        header: 'Warnings',
        render: (row: TeamImportResultRow) => row.warnings.join('; ') || '-',
      },
      {
        key: 'reason',
        header: 'Reason',
        render: (row: TeamImportResultRow) => row.reason || row.displayId || '-',
      },
    ],
    []
  )

  if (permLoading) {
    return <PageLoader message="Loading team import..." />
  }

  if (!hasRosterAccess) {
    return (
      <AccessDenied
        title="Access Denied"
        message="Full admin access is required to import teams into a season."
      />
    )
  }

  if (loading) {
    return <PageLoader message="Loading team import..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/teams"
            className="mb-2 inline-flex items-center text-sm text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to teams
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Bulk Import Teams</h1>
          <p className="text-text-secondary">
            Upload a season-specific team roster, review validation results, and confirm the import.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline">
            <a href="/templates/team-import-template.xlsx" download>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Download Template
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>
            Preview runs validation only. Teams are created only after you confirm the import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="season">Season</Label>
              <Select
                value={selectedSeasonId}
                onValueChange={(value) => {
                  setSelectedSeasonId(value)
                  setPreview(null)
                  setResult(null)
                }}
              >
                <SelectTrigger id="season">
                  <SelectValue placeholder="Select a season" />
                </SelectTrigger>
                <SelectContent>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} ({season.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Import File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null)
                  setPreview(null)
                  setResult(null)
                }}
              />
              <p className="text-xs text-text-muted">
                Supported formats: normalized CSV, normalized XLSX, and the current legacy workbook XLSX.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-secondary p-4 text-sm text-text-secondary">
            <p className="font-medium text-foreground">Validation checks</p>
            <p className="mt-1">
              The preview checks required columns, email formatting, same-university rules, supervisor caps,
              duplicate identifiers, team size, and existing team membership conflicts before anything is written.
            </p>
            <p className="mt-2">
              Students can be reused across seasons, but they cannot already belong to another team in the selected season.
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-error/20 bg-error-background px-4 py-3 text-sm text-error">
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={handlePreview} disabled={previewLoading || confirmLoading}>
              {previewLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Preview Import
            </Button>
            <Button
              variant="outline"
              onClick={handleConfirm}
              disabled={!preview || preview.summary.validRows === 0 || previewLoading || confirmLoading}
            >
              {confirmLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Import
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid gap-6 md:grid-cols-5">
            <Card variant="metric">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Rows Parsed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{preview.summary.totalRows}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-success/20 bg-success-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Valid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-success">{preview.summary.validRows}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-error/20 bg-error-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Invalid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-error">{preview.summary.invalidRows}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-warning/20 bg-warning-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">{preview.summary.rowsWithWarnings}</p>
              </CardContent>
            </Card>
            <Card variant="metric">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Ignored Empty Rows</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{preview.summary.ignoredEmptyRows}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {preview.fileName} for {preview.season.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={preview.rows}
                columns={previewColumns}
                searchKeys={['teamExternalId', 'teamName', 'universityName', 'submitterEmail', 'submitter.displayName', 'supervisorEmail', 'warnings', 'errors']}
                searchPlaceholder="Search preview rows..."
                pageSize={20}
                filters={[
                  {
                    key: 'valid',
                    label: 'Status',
                    options: [
                      { value: 'true', label: 'Valid' },
                      { value: 'false', label: 'Invalid' },
                    ],
                  },
                ]}
              />
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <>
          <div className="grid gap-6 md:grid-cols-5">
            <Card variant="metric">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Rows Parsed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{result.summary.totalRows}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-success/20 bg-success-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Teams Created</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-success">{result.summary.teamsCreated}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-warning/20 bg-warning-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Warning Rows</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">{result.summary.rowsWithWarnings}</p>
              </CardContent>
            </Card>
            <Card variant="metric" className="border-warning/20 bg-warning-background/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Skipped</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-warning">{result.summary.skippedRows}</p>
              </CardContent>
            </Card>
            <Card variant="metric">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-text-secondary">Season</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{result.season.name}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Import Results</CardTitle>
              <CardDescription>
                Created teams are ready immediately. Skipped rows include the exact reason.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={result.rows}
                columns={resultColumns}
                searchKeys={['teamExternalId', 'teamName', 'universityName', 'submitterEmail', 'submitter.displayName', 'warnings', 'reason', 'displayId']}
                searchPlaceholder="Search import results..."
                pageSize={20}
              />
            </CardContent>
          </Card>
        </>
      )}

    </div>
  )
}
