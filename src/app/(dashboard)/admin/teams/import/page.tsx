'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Hash,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ImportDiagnostic } from '@/lib/team-import/diagnostics'
import { diagnosticForLegacyMessage } from '@/lib/team-import/diagnostic-catalog'
import type {
  TeamImportConfirmResult,
  TeamImportPersonSummary,
  TeamImportPreviewRow,
  TeamImportPreviewSummary,
  TeamImportResultRow,
  TeamImportOverride,
  TeamImportColumnMapping,
  ImportAssistSuggestion,
  ImportAssistUnavailableCategory,
} from '@/lib/team-import/types'
import { ManualMapping, RosterRow, resetRowOverrides, upsertOverride, type RosterAssistAvailability } from '@/app/(dashboard)/supervisor/import/supervisor-import-client'
import { recordImportAssistOutcome, requestImportExplanation, requestImportLayoutAssist, requestImportRepairAssist } from '@/features/teams/roster-import-api'
import {
  filterAdminImportRows,
  getAdminImportRowStatus,
  groupImportDiagnostics,
  IMPORT_RESOLUTION_LABELS,
  type AdminImportRowFilter,
} from '@/features/teams/admin-import-ui'
import { csrfFetch } from '@/lib/csrf'
import { clientLogger } from '@/lib/client-logger'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { AccessDenied } from '@/components/ui/access-denied'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  importAssistMode: 'DISABLED' | 'ON_DEMAND'
}
interface ImportUniversityOption { id: string; name: string; country: string | null }
interface ImportSupervisorOption { id: string; firstName: string; lastName: string; email: string; universityId: string; teamCount: number; teamCountsBySeason?: Record<string, number> }

interface PreviewResponse {
  batchId: string
  fileHash: string
  fileName: string
  season: {
    id: string
    name: string
    status: string
  }
  summary: TeamImportPreviewSummary
  rows: TeamImportPreviewRow[]
  overrides: TeamImportOverride[]
  excludedRowNumbers: number[]
  trustedContext?: { universityId: string; supervisorId: string } | null
  fileWarnings: string[]
  templateVersion?: string | null
  assist?: RosterAssistAvailability
}

type AssistUnavailable = { category: ImportAssistUnavailableCategory; message: string; model?: string; region?: string; lastSuccessfulCall?: string | null; recommendedAction?: string }
type LayoutAssistResponse = { batchId: string; fileHash: string; available: boolean; suggestion?: ImportAssistSuggestion; mapping?: TeamImportColumnMapping; unavailable?: AssistUnavailable }

const FILTERS: Array<{ value: AdminImportRowFilter; label: string }> = [
  { value: 'ALL', label: 'All teams' },
  { value: 'NEEDS_ATTENTION', label: 'Needs attention' },
  { value: 'WARNINGS', label: 'Warnings' },
  { value: 'READY', label: 'Ready' },
  { value: 'REMOVED', label: 'Removed' },
]

function normalizePreviewRows(rows: TeamImportPreviewRow[]) {
  return rows.map((row) => {
    if (row.diagnostics?.length) return row
    return {
      ...row,
      diagnostics: [
        ...row.errors.map((message) => diagnosticForLegacyMessage(message, 'ERROR')),
        ...row.warnings.map((message) => diagnosticForLegacyMessage(message, 'WARNING')),
      ],
    }
  })
}

function personName(person: TeamImportPersonSummary) {
  return person.displayName || [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email
}

function PersonLine({ person, role }: { person: TeamImportPersonSummary; role?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-secondary px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">{personName(person)}</p>
        {role ? <Badge variant="info">{role}</Badge> : null}
      </div>
      <p className="mt-0.5 truncate font-mono text-xs text-text-secondary">{person.email || 'Email missing'}</p>
      {person.nameMismatch && person.uploadedName && person.matchedName ? (
        <div className="mt-2 rounded-md bg-warning-background px-2.5 py-2 text-xs text-warning">
          Uploaded as {person.uploadedName}; matched to {person.matchedName}.
        </div>
      ) : null}
    </div>
  )
}

function Step({ number, label, state }: { number: number; label: string; state: 'complete' | 'current' | 'upcoming' }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
          state === 'complete' && 'border-success bg-success-background text-success',
          state === 'current' && 'border-primary bg-primary text-primary-foreground',
          state === 'upcoming' && 'border-border bg-surface-secondary text-text-muted'
        )}
        aria-current={state === 'current' ? 'step' : undefined}
      >
        {state === 'complete' ? <CheckCircle2 className="h-4 w-4" /> : number}
      </span>
      <span className={cn('truncate text-sm font-medium', state === 'upcoming' ? 'text-text-muted' : 'text-foreground')}>
        {label}
      </span>
    </div>
  )
}

function RowStatusBadge({ row }: { row: TeamImportPreviewRow }) {
  const status = getAdminImportRowStatus(row)
  if (status === 'READY') {
    return (
      <Badge variant="success">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Ready
      </Badge>
    )
  }
  if (status === 'WARNINGS') {
    return (
      <Badge variant="warning">
        <AlertTriangle className="mr-1 h-3.5 w-3.5" /> Review warning
      </Badge>
    )
  }
  return (
    <Badge variant="error">
      <AlertCircle className="mr-1 h-3.5 w-3.5" /> Needs attention
    </Badge>
  )
}

function DiagnosticCard({ diagnostic }: { diagnostic: ImportDiagnostic }) {
  const isError = diagnostic.severity === 'ERROR'
  const Icon = isError ? AlertCircle : AlertTriangle

  return (
    <div
      className={cn(
        'rounded-xl border p-3.5',
        isError ? 'border-error/20 bg-error-background' : 'border-warning/20 bg-warning-background'
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', isError ? 'text-error' : 'text-warning')} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{diagnostic.title}</p>
            {diagnostic.provenance ? (
              <span className="font-mono text-xs text-text-muted">{diagnostic.provenance}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-6 text-text-secondary">{diagnostic.explanation}</p>
          <p className="mt-2 text-sm font-medium text-foreground">
            Next step: {IMPORT_RESOLUTION_LABELS[diagnostic.resolution]}
          </p>
          {diagnostic.legacyMessage && diagnostic.legacyMessage !== diagnostic.explanation ? (
            <details className="mt-2 text-xs text-text-muted">
              <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Source detail
              </summary>
              <p className="mt-1 break-words font-mono leading-5">{diagnostic.legacyMessage}</p>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function IssueAction({ diagnostic }: { diagnostic: ImportDiagnostic }) {
  if (diagnostic.code.startsWith('UNIVERSITY_')) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/admin/universities">Manage universities</Link>
      </Button>
    )
  }
  if (diagnostic.code.startsWith('SUPERVISOR_')) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/admin/supervisors">Manage supervisors</Link>
      </Button>
    )
  }
  if (diagnostic.resolution === 'DOWNLOAD_TEMPLATE') {
    return (
      <Button asChild variant="outline" size="sm">
        <a href="#import-setup">Select context and download template</a>
      </Button>
    )
  }
  return null
}

function TeamPreviewCard({
  row,
  expanded,
  onToggle,
}: {
  row: TeamImportPreviewRow
  expanded: boolean
  onToggle: () => void
}) {
  const errorCount = row.diagnostics.filter((diagnostic) => diagnostic.severity === 'ERROR').length
  const warningCount = row.diagnostics.filter((diagnostic) => diagnostic.severity === 'WARNING').length

  return (
    <article
      id={`import-row-${row.rowNumber}`}
      className={cn(
        'scroll-mt-28 overflow-hidden rounded-xl border bg-card shadow-sm',
        !row.valid ? 'border-error/30' : row.warningCount > 0 ? 'border-warning/30' : 'border-border'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
        aria-expanded={expanded}
        aria-controls={`import-row-details-${row.rowNumber}`}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-text-muted">ROW {row.rowNumber}</span>
            <RowStatusBadge row={row} />
          </div>
          <h3 className="mt-2 truncate font-display text-xl font-semibold text-foreground">
            {row.teamName || 'Unnamed team'}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {row.memberCount} {row.memberCount === 1 ? 'student' : 'students'}
            {errorCount > 0 ? ` · ${errorCount} blocking ${errorCount === 1 ? 'issue' : 'issues'}` : ''}
            {warningCount > 0 ? ` · ${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}` : ''}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary">
          {expanded ? 'Hide details' : 'Review details'}
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>

      <div className="grid gap-px border-y border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            <Hash className="h-3.5 w-3.5" /> Team ID
          </div>
          <p className="mt-1 truncate font-mono text-sm text-foreground">{row.teamExternalId || 'Missing'}</p>
        </div>
        <div className="min-w-0 bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            <Building2 className="h-3.5 w-3.5" /> University
          </div>
          <p className="mt-1 truncate text-sm text-foreground">{row.universityName || 'Not recognized'}</p>
        </div>
        <div className="min-w-0 bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            <UserRound className="h-3.5 w-3.5" /> Supervisor
          </div>
          <p className={cn('mt-1 truncate text-sm', row.supervisorLabel || row.supervisorEmail ? 'text-foreground' : 'font-medium text-error')}>
            {row.supervisorLabel || row.supervisorEmail || 'Needs supervisor'}
          </p>
        </div>
        <div className="min-w-0 bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
            <Users className="h-3.5 w-3.5" /> Submitter
          </div>
          <p className="mt-1 truncate text-sm text-foreground">{personName(row.submitter)}</p>
        </div>
      </div>

      {expanded ? (
        <div id={`import-row-details-${row.rowNumber}`} className="space-y-5 px-4 py-5 sm:px-5">
          {row.diagnostics.length > 0 ? (
            <section aria-labelledby={`issues-${row.rowNumber}`}>
              <h4 id={`issues-${row.rowNumber}`} className="mb-3 text-sm font-semibold text-foreground">
                What needs review
              </h4>
              <div className="grid gap-3 lg:grid-cols-2">
                {row.diagnostics.map((diagnostic, index) => (
                  <DiagnosticCard key={`${diagnostic.code}-${diagnostic.provenance ?? index}`} diagnostic={diagnostic} />
                ))}
              </div>
            </section>
          ) : (
            <AlertBanner variant="success" title="This team is ready">
              RevME found the required team, supervisor, and student information.
            </AlertBanner>
          )}

          <section aria-labelledby={`roster-${row.rowNumber}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 id={`roster-${row.rowNumber}`} className="text-sm font-semibold text-foreground">Team roster</h4>
              <span className="font-mono text-xs text-text-muted">{row.memberCount} total</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <PersonLine person={row.submitter} role="Submitter" />
              {row.members.map((member, index) => (
                <PersonLine key={`${member.email}-${index}`} person={member} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </article>
  )
}

function ResultCard({ row }: { row: TeamImportResultRow }) {
  const created = row.status === 'created'
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-text-muted">ROW {row.rowNumber}</p>
          <h3 className="mt-1 truncate font-display text-lg font-semibold text-foreground">{row.teamName || 'Unnamed team'}</h3>
          <p className="mt-1 font-mono text-xs text-text-secondary">{row.teamExternalId || 'No team ID'}</p>
        </div>
        <Badge variant={created ? 'success' : 'warning'}>
          {created ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
          {created ? 'Created' : 'Skipped'}
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">University</p>
          <p className="mt-1 text-foreground">{row.universityName || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Submitter</p>
          <p className="mt-1 text-foreground">{personName(row.submitter)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Students</p>
          <p className="mt-1 font-mono text-foreground">{row.memberCount}</p>
        </div>
      </div>
      {row.reason ? <p className="mt-4 rounded-lg bg-warning-background px-3 py-2 text-sm text-warning">{row.reason}</p> : null}
      {row.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-warning">
          {row.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
        </ul>
      ) : null}
    </article>
  )
}

export default function AdminTeamsImportPage() {
  const { loading: permLoading, isAdmin, hasFullAccess } = usePermissions()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [assistInfrastructureAvailable, setAssistInfrastructureAvailable] = useState(false)
  const [seasons, setSeasons] = useState<ImportSeasonOption[]>([])
  const [universities, setUniversities] = useState<ImportUniversityOption[]>([])
  const [supervisors, setSupervisors] = useState<ImportSupervisorOption[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [selectedUniversityId, setSelectedUniversityId] = useState('')
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [result, setResult] = useState<TeamImportConfirmResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [filter, setFilter] = useState<AdminImportRowFilter>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [overrides, setOverrides] = useState<TeamImportOverride[]>([])
  const [excludedRowNumbers, setExcludedRowNumbers] = useState<number[]>([])
  const [columnMapping, setColumnMapping] = useState<TeamImportColumnMapping | null>(null)
  const [layoutAssist, setLayoutAssist] = useState<LayoutAssistResponse | null>(null)
  const [repairSuggestions, setRepairSuggestions] = useState<ImportAssistSuggestion[]>([])
  const [explanation, setExplanation] = useState<{ summary: string; nextSteps: string[] } | null>(null)
  const [assistUnavailable, setAssistUnavailable] = useState<AssistUnavailable | null>(null)
  const [assistLoading, setAssistLoading] = useState(false)
  const [mappingRows, setMappingRows] = useState<string[][] | null>(null)
  const hasRosterAccess = isAdmin || hasFullAccess
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId) ?? null
  const assistEnabled = Boolean(isAdmin && assistInfrastructureAvailable && selectedSeason?.importAssistMode === 'ON_DEMAND')

  const fetchOptions = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/teams/import/options')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load seasons')
      setSeasons(data.seasons || [])
      setAssistInfrastructureAvailable(Boolean(data.assistInfrastructureAvailable))
      setUniversities(data.universities || [])
      setSupervisors(data.supervisors || [])
      setSelectedSeasonId((current) => current || data.seasons?.[0]?.id || '')
    } catch (error) {
      clientLogger.error('Failed to load team import options:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load import options')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!permLoading && hasRosterAccess) void fetchOptions()
  }, [fetchOptions, hasRosterAccess, permLoading])

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file)
    setPreview(null)
    setResult(null)
    setErrorMessage('')
    setFilter('ALL')
    setSearchQuery('')
    setExpandedRows(new Set())
    setOverrides([])
    setExcludedRowNumbers([])
    setColumnMapping(null)
    setLayoutAssist(null)
    setRepairSuggestions([])
    setExplanation(null)
    setAssistUnavailable(null)
    setMappingRows(null)
  }

  const clearImportAfterContextChange = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setPreview(null)
    setResult(null)
    setErrorMessage('')
    setOverrides([])
    setExcludedRowNumbers([])
    setColumnMapping(null)
    setLayoutAssist(null)
    setRepairSuggestions([])
    setExplanation(null)
    setAssistUnavailable(null)
    setMappingRows(null)
  }

  const supervisorSeasonCount = (supervisor: ImportSupervisorOption) => supervisor.teamCountsBySeason?.[selectedSeasonId] ?? 0
  const availableSupervisors = supervisors.filter((supervisor) => supervisor.universityId === selectedUniversityId && supervisorSeasonCount(supervisor) < 10)
  const contextReady = Boolean(selectedSeasonId && selectedUniversityId && selectedSupervisorId)

  const downloadTemplate = async () => {
    if (!contextReady) { toast.error('Select a season, university, and supervisor first'); return }
    try {
      const params = new URLSearchParams({ seasonId: selectedSeasonId, universityId: selectedUniversityId, supervisorId: selectedSupervisorId })
      const response = await csrfFetch(`/api/admin/teams/import/template?${params}`)
      if (!response.ok) { const data = await response.json(); throw new Error(data.message || 'Template download failed') }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ?? 'revme-roster-template.xlsx'; anchor.click(); URL.revokeObjectURL(url)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Template download failed') }
  }

  const handlePreview = async (nextOverrides = overrides, nextExcluded = excludedRowNumbers, nextMapping = columnMapping) => {
    if (!selectedSeasonId) {
      toast.error('Select a season before previewing the file')
      return
    }
    if (!selectedUniversityId || !selectedSupervisorId) {
      toast.error('Select a university and supervisor before previewing the file')
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
      formData.append('universityId', selectedUniversityId)
      formData.append('supervisorId', selectedSupervisorId)
      formData.append('file', selectedFile)
      const identity = preview ?? layoutAssist
      if (identity?.batchId) formData.append('batchId', identity.batchId)
      if (identity?.fileHash) formData.append('fileHash', identity.fileHash)
      formData.append('overrides', JSON.stringify(nextOverrides))
      formData.append('excludedRowNumbers', JSON.stringify(nextExcluded))
      if (nextMapping) formData.append('columnMapping', JSON.stringify(nextMapping))
      const res = await csrfFetch('/api/admin/teams/import/preview', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setMappingRows(data.details?.mappingContext?.rows ?? null)
        throw new Error(data.message || 'Failed to preview import file')
      }

      const normalizedRows = normalizePreviewRows(data.rows || [])
      setPreview({ ...data, rows: normalizedRows })
      setOverrides(data.overrides ?? nextOverrides)
      setExcludedRowNumbers(data.excludedRowNumbers ?? nextExcluded)
      setColumnMapping(nextMapping)
      setLayoutAssist(null)
      setRepairSuggestions([])
      setExplanation(null)
      setMappingRows(null)
      const firstInvalid = normalizedRows.find((row) => !row.valid)
      setExpandedRows(firstInvalid ? new Set([firstInvalid.rowNumber]) : new Set())
      setFilter(firstInvalid ? 'NEEDS_ATTENTION' : 'ALL')
      toast.success(`Preview ready: ${data.summary.validRows} ready, ${data.summary.invalidRows} need attention`)
    } catch (error) {
      clientLogger.error('Failed to preview team import:', error)
      if (!preview) setPreview(null)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to preview import file')
      toast.error(error instanceof Error ? error.message : 'Failed to preview import file')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedSeasonId || !selectedFile || !preview) {
      toast.error('Preview the selected season and file before confirming')
      return
    }

    setConfirmLoading(true)
    setErrorMessage('')
    try {
      const formData = new FormData()
      formData.append('seasonId', selectedSeasonId)
      formData.append('universityId', selectedUniversityId)
      formData.append('supervisorId', selectedSupervisorId)
      formData.append('file', selectedFile)
      if (preview.batchId) formData.append('batchId', preview.batchId)
      formData.append('fileHash', preview.fileHash)
      formData.append('overrides', JSON.stringify(overrides))
      formData.append('excludedRowNumbers', JSON.stringify(excludedRowNumbers))
      if (columnMapping) formData.append('columnMapping', JSON.stringify(columnMapping))
      const res = await csrfFetch('/api/admin/teams/import/confirm', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to confirm import')

      setResult(data)
      setConfirmOpen(false)
      toast.success(`Imported ${data.summary.teamsCreated} team${data.summary.teamsCreated === 1 ? '' : 's'}`)
      window.setTimeout(() => document.getElementById('import-results')?.scrollIntoView({ behavior: 'smooth' }), 0)
    } catch (error) {
      clientLogger.error('Failed to confirm team import:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to confirm import')
      toast.error(error instanceof Error ? error.message : 'Failed to confirm import')
    } finally {
      setConfirmLoading(false)
    }
  }

  const diagnosticGroups = useMemo(() => preview ? groupImportDiagnostics(preview.rows) : [], [preview])
  const filteredRows = useMemo(
    () => preview ? filterAdminImportRows(preview.rows, filter, searchQuery) : [],
    [filter, preview, searchQuery]
  )
  const readiness = preview?.summary.totalRows
    ? Math.round((preview.summary.validRows / preview.summary.totalRows) * 100)
    : 0
  const filterCounts = useMemo(() => {
    const rows = preview?.rows ?? []
    return {
      ALL: rows.length,
      NEEDS_ATTENTION: rows.filter((row) => getAdminImportRowStatus(row) === 'NEEDS_ATTENTION').length,
      WARNINGS: rows.filter((row) => getAdminImportRowStatus(row) === 'WARNINGS').length,
      READY: rows.filter((row) => getAdminImportRowStatus(row) === 'READY').length,
      REMOVED: rows.filter((row) => getAdminImportRowStatus(row) === 'REMOVED').length,
    }
  }, [preview])

  const saveOverrides = (updates: TeamImportOverride[]) => setOverrides((current) => updates.reduce(upsertOverride, current))
  const resetRow = async (rowNumber: number) => {
    const next = resetRowOverrides(overrides, rowNumber)
    setOverrides(next)
    await handlePreview(next, excludedRowNumbers)
  }
  const toggleExcluded = async (rowNumber: number, excluded: boolean) => {
    const nextExcluded = excluded ? [...new Set([...excludedRowNumbers, rowNumber])].sort((a, b) => a - b) : excludedRowNumbers.filter((value) => value !== rowNumber)
    const nextOverrides = excluded ? resetRowOverrides(overrides, rowNumber) : overrides
    setExcludedRowNumbers(nextExcluded)
    setOverrides(nextOverrides)
    setRepairSuggestions((current) => current.filter((suggestion) => suggestion.rowNumber !== rowNumber))
    await handlePreview(nextOverrides, nextExcluded)
  }

  const getLayoutHelp = async () => {
    if (!selectedFile || !contextReady) return
    setAssistLoading(true)
    setAssistUnavailable(null)
    try {
      const identity = preview ?? layoutAssist
      const response = await requestImportLayoutAssist<LayoutAssistResponse>(selectedFile, {
        seasonId: selectedSeasonId,
        universityId: selectedUniversityId,
        supervisorId: selectedSupervisorId,
        ...(identity ? { batchId: identity.batchId, fileHash: identity.fileHash } : {}),
      })
      setLayoutAssist(response)
      if (!response.available && response.unavailable) setAssistUnavailable(response.unavailable)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI mapping assistance is unavailable')
    } finally {
      setAssistLoading(false)
    }
  }

  const decideLayout = async (accepted: boolean) => {
    if (!layoutAssist?.suggestion) return
    setAssistLoading(true)
    try {
      await recordImportAssistOutcome(layoutAssist.batchId, layoutAssist.suggestion.id, accepted ? 'ACCEPTED' : 'REJECTED', selectedSeasonId)
      if (accepted && layoutAssist.mapping) {
        setColumnMapping(layoutAssist.mapping)
        await handlePreview(overrides, excludedRowNumbers, layoutAssist.mapping)
      } else {
        setLayoutAssist(null)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply the mapping suggestion')
    } finally {
      setAssistLoading(false)
    }
  }

  const explainIssues = async () => {
    if (!selectedFile || !preview) return
    setAssistLoading(true)
    setAssistUnavailable(null)
    try {
      const response = await requestImportExplanation<{ available: boolean; explanation?: { summary: string; nextSteps: string[] }; unavailable?: AssistUnavailable }>(selectedFile, {
        seasonId: selectedSeasonId,
        batchId: preview.batchId,
        fileHash: preview.fileHash,
        overrides,
        columnMapping,
        excludedRowNumbers,
      })
      setExplanation(response.explanation ?? null)
      if (!response.available && response.unavailable) setAssistUnavailable(response.unavailable)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI explanation is unavailable')
    } finally {
      setAssistLoading(false)
    }
  }

  const getRepairHelp = async () => {
    if (!selectedFile || !preview) return
    setAssistLoading(true)
    setAssistUnavailable(null)
    try {
      const response = await requestImportRepairAssist<{ available: boolean; suggestions: ImportAssistSuggestion[]; unavailable?: AssistUnavailable }>(selectedFile, {
        seasonId: selectedSeasonId,
        batchId: preview.batchId,
        fileHash: preview.fileHash,
        overrides,
        columnMapping,
        excludedRowNumbers,
      })
      setRepairSuggestions(response.suggestions ?? [])
      if (!response.available && response.unavailable) setAssistUnavailable(response.unavailable)
      else if (!response.suggestions.length) toast.message('No AI repair suggestions are available')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI repair assistance is unavailable')
    } finally {
      setAssistLoading(false)
    }
  }

  const decideRepair = async (suggestion: ImportAssistSuggestion, accepted: boolean, editedValue?: string) => {
    if (!preview || !suggestion.rowNumber || !suggestion.columnLabel || !suggestion.field) return
    setAssistLoading(true)
    try {
      await recordImportAssistOutcome(preview.batchId, suggestion.id, accepted ? 'ACCEPTED' : 'REJECTED', selectedSeasonId)
      setRepairSuggestions((current) => current.filter((item) => item.id !== suggestion.id))
      if (accepted) {
        const row = preview.rows.find((item) => item.rowNumber === suggestion.rowNumber)
        const person = suggestion.columnLabel === 'Corresponding Team Member'
          ? row?.submitter
          : row?.members.find((item) => item.provenance.endsWith(suggestion.columnLabel!))
        const original = suggestion.sourceValue ?? (suggestion.columnLabel === 'Team'
          ? String(row?.[suggestion.field as 'teamName' | 'teamExternalId'] ?? '')
          : String(person?.[suggestion.field as 'firstName' | 'lastName' | 'email'] ?? ''))
        const next = upsertOverride(overrides, { rowNumber: suggestion.rowNumber, columnLabel: suggestion.columnLabel, field: suggestion.field, original, value: editedValue ?? suggestion.suggestion })
        setOverrides(next)
        await handlePreview(next, excludedRowNumbers, columnMapping)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply the AI suggestion')
    } finally {
      setAssistLoading(false)
    }
  }

  const focusNextIssue = () => {
    const invalidRows = preview?.rows.filter((row) => !row.valid && !row.excluded) ?? []
    if (invalidRows.length === 0) return
    const next = invalidRows[0]
    setFilter('NEEDS_ATTENTION')
    setSearchQuery('')
    window.setTimeout(() => document.getElementById(`roster-row-${next.rowNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  if (permLoading || loading) return <PageLoader message="Loading team import..." />
  if (!hasRosterAccess) {
    return <AccessDenied title="Access Denied" message="Full admin access is required to import teams into a season." />
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/teams" className="mb-2 inline-flex items-center text-sm text-text-secondary transition-colors hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to teams
          </Link>
          <h1 className="font-display text-3xl font-semibold text-foreground">Import teams</h1>
          <p className="mt-1 text-text-secondary">Upload a roster, resolve validation issues, and import only ready teams.</p>
        </div>
        <Button variant="outline" disabled={!contextReady} onClick={() => void downloadTemplate()}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Download current template
        </Button>
      </div>

      <Card id="import-setup">
        <CardContent className="py-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Import progress">
            <Step number={1} label="Upload roster" state={selectedFile ? 'complete' : 'current'} />
            <Step number={2} label="Validate file" state={preview ? 'complete' : selectedFile ? 'current' : 'upcoming'} />
            <Step number={3} label="Review teams" state={result ? 'complete' : preview ? 'current' : 'upcoming'} />
            <Step number={4} label="Confirm import" state={result ? 'complete' : preview?.summary.validRows ? 'current' : 'upcoming'} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roster file</CardTitle>
          <CardDescription>Preview validates the workbook without creating teams or student accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="season">Season</Label>
              <Select value={selectedSeasonId} onValueChange={(value) => { setSelectedSeasonId(value); clearImportAfterContextChange() }}>
                <SelectTrigger id="season"><SelectValue placeholder="Select a season" /></SelectTrigger>
                <SelectContent>
                  {seasons.map((season) => <SelectItem key={season.id} value={season.id}>{season.name} ({season.status})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="university">University</Label>
              <Select value={selectedUniversityId} onValueChange={(value) => { setSelectedUniversityId(value); setSelectedSupervisorId(''); clearImportAfterContextChange() }}>
                <SelectTrigger id="university"><SelectValue placeholder="Select a university" /></SelectTrigger>
                <SelectContent>{universities.map((university) => <SelectItem key={university.id} value={university.id}>{university.name}{university.country ? ` · ${university.country}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Select value={selectedSupervisorId} disabled={!selectedUniversityId} onValueChange={(value) => { setSelectedSupervisorId(value); clearImportAfterContextChange() }}>
                <SelectTrigger id="supervisor"><SelectValue placeholder="Select an active supervisor" /></SelectTrigger>
                <SelectContent>{availableSupervisors.map((supervisor) => <SelectItem key={supervisor.id} value={supervisor.id}>{`${supervisor.firstName} ${supervisor.lastName}`.trim()} · {supervisor.email} ({supervisorSeasonCount(supervisor)}/10)</SelectItem>)}</SelectContent>
              </Select>
              {selectedUniversityId && availableSupervisors.length === 0 ? <p className="text-sm text-warning">No active supervisor with available capacity belongs to this university.</p> : null}
            </div>

            <div className="space-y-2 lg:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary p-4">
                <div><p className="font-medium text-foreground">Start with the context-bound template</p><p className="mt-1 text-sm text-text-secondary">University and supervisor details are protected and verified again during preview and confirmation.</p></div>
                <Button type="button" variant="outline" disabled={!contextReady} onClick={() => void downloadTemplate()}><FileSpreadsheet className="mr-2 h-4 w-4"/>Download template</Button>
              </div>
            </div>

            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="file">Import file</Label>
              <input
                ref={fileInputRef}
                id="file"
                className="sr-only"
                type="file"
                accept=".csv,.xlsx"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
              />
              <div className="flex min-h-20 flex-col gap-3 rounded-xl border border-dashed border-border bg-surface-secondary p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{selectedFile?.name || 'No roster selected'}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB · ${selectedFile.name.split('.').pop()?.toUpperCase()}` : 'CSV or XLSX, up to 10 MB'}
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  {selectedFile ? 'Choose another file' : 'Choose file'}
                </Button>
              </div>
            </div>
          </div>

          {errorMessage ? <AlertBanner variant="error" title="Import could not continue">{errorMessage}</AlertBanner> : null}

          {assistUnavailable && !preview ? (
            <AlertBanner variant="warning" title={`AI assistance unavailable · ${assistUnavailable.category}`}>
              <div className="space-y-1">
                <p>{assistUnavailable.message}</p>
                <p className="font-mono text-xs">{assistUnavailable.model ?? 'Configured model'} · {assistUnavailable.region ?? 'Configured region'}</p>
                <p className="text-xs">Last successful call: {assistUnavailable.lastSuccessfulCall ? new Date(assistUnavailable.lastSuccessfulCall).toLocaleString() : 'none recorded'}</p>
                {assistUnavailable.recommendedAction ? <p className="text-sm font-medium">Recommended action: {assistUnavailable.recommendedAction}</p> : null}
              </div>
            </AlertBanner>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => void handlePreview()} disabled={!contextReady || !selectedFile || previewLoading || confirmLoading}>
              {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {preview ? 'Preview again' : 'Preview roster'}
            </Button>
            {preview ? (
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose another file
              </Button>
            ) : null}
            {assistEnabled && selectedFile && errorMessage ? <Button variant="outline" disabled={assistLoading} onClick={() => void getLayoutHelp()}><Sparkles className="mr-2 h-4 w-4"/>Get AI mapping help</Button> : null}
          </div>

          {layoutAssist?.available && layoutAssist.mapping ? (
            <div className="rounded-xl border border-border bg-primary-soft p-4">
              <div className="flex flex-wrap items-center gap-2"><Sparkles className="h-4 w-4 text-primary"/><p className="font-semibold text-foreground">AI-generated suggested mapping</p><Badge variant="info">{Math.round((layoutAssist.suggestion?.confidence ?? 0) * 100)}% confidence</Badge></div>
              <p className="mt-2 text-sm text-text-secondary">Header row {layoutAssist.mapping.headerRowIndex + 1} · {layoutAssist.mapping.columnMap.length} columns mapped. Applying this suggestion runs the complete deterministic preview again.</p>
              <div className="mt-3 flex gap-2"><Button size="sm" disabled={assistLoading} onClick={() => void decideLayout(true)}>Apply mapping</Button><Button size="sm" variant="outline" disabled={assistLoading} onClick={() => void decideLayout(false)}>Dismiss</Button></div>
            </div>
          ) : null}

          {mappingRows ? <ManualMapping rows={mappingRows} loading={previewLoading || assistLoading} onApply={(mapping) => { setColumnMapping(mapping); void handlePreview(overrides, excludedRowNumbers, mapping) }}/>: null}
        </CardContent>
      </Card>

      {preview ? (
        <>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="p-5 sm:p-6">
                  <p className="text-sm font-medium text-text-secondary">Import readiness</p>
                  <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className="font-display text-3xl font-semibold text-foreground">
                      {preview.summary.validRows} of {preview.summary.totalRows} teams ready
                    </p>
                    <span className="pb-1 font-mono text-sm text-text-muted">{readiness}%</span>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-secondary" role="progressbar" aria-label="Teams ready to import" aria-valuenow={readiness} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${readiness}%` }} />
                  </div>
                  <p className="mt-3 text-sm text-text-secondary">
                    {preview.summary.invalidRows > 0
                      ? `${preview.summary.invalidRows} ${preview.summary.invalidRows === 1 ? 'team needs' : 'teams need'} attention before they can be imported.`
                      : 'All teams passed deterministic validation and are ready to import.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 border-t border-border bg-surface-secondary sm:grid-cols-4 lg:border-l lg:border-t-0">
                  {[
                    ['Ready', preview.summary.validRows, 'text-success'],
                    ['Needs attention', preview.summary.invalidRows, 'text-error'],
                    ['Warnings', preview.summary.rowsWithWarnings, 'text-warning'],
                    ['Ignored rows', preview.summary.ignoredEmptyRows, 'text-foreground'],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} className="min-w-28 border-r border-border px-4 py-4 last:border-r-0 lg:flex lg:min-w-32 lg:flex-col lg:justify-center">
                      <p className="text-xs font-medium text-text-muted">{label}</p>
                      <p className={cn('mt-1 font-mono text-2xl font-semibold', color)}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {preview.fileWarnings.length > 0 ? <div className="space-y-2">{preview.fileWarnings.map((warning) => <AlertBanner key={warning} variant="warning">{warning}</AlertBanner>)}</div> : null}

          {assistEnabled && preview.assist ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/>Import assistant</CardTitle><CardDescription>AI is optional. Every suggestion is reviewed by you and revalidated by RevME.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {preview.assist.layoutRelevant ? <Button variant="outline" disabled={assistLoading || !preview.assist.layoutEligible} onClick={() => void getLayoutHelp()}><Sparkles className="mr-2 h-4 w-4"/>Map columns ({preview.assist.usage.layout.remaining})</Button> : null}
                  {preview.assist.explanationRelevant ? <Button variant="outline" disabled={assistLoading || !preview.assist.explanationEligible} onClick={() => void explainIssues()}><Sparkles className="mr-2 h-4 w-4"/>Explain issues ({preview.assist.usage.explanation.remaining})</Button> : null}
                  {preview.assist.repairRelevant ? <Button variant="outline" disabled={assistLoading || !preview.assist.repairEligible} onClick={() => void getRepairHelp()}><Sparkles className="mr-2 h-4 w-4"/>Suggest fixes ({preview.assist.usage.repair.remaining})</Button> : null}
                </div>
                <p className="text-xs text-text-muted">{preview.assist.usage.remainingTotal} of 8 successful requests remain for this roster version. Infrastructure failures do not consume this allowance.</p>
                {!preview.assist.explanationRelevant && !preview.assist.repairRelevant ? <p className="text-sm text-text-secondary">The current messages have deterministic guidance and no editable field needs an AI suggestion.</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {explanation ? <AlertBanner variant="info" title="AI-assisted explanation"><div><p>{explanation.summary}</p><ol className="mt-2 list-decimal space-y-1 pl-5">{explanation.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol><p className="mt-2 text-xs">Deterministic validation remains authoritative.</p></div></AlertBanner> : null}

          {assistUnavailable ? (
            <AlertBanner variant="warning" title={`AI assistance unavailable · ${assistUnavailable.category}`}>
              <div className="space-y-1"><p>{assistUnavailable.message}</p><p className="font-mono text-xs">{assistUnavailable.model ?? 'Configured model'} · {assistUnavailable.region ?? 'Configured region'}</p><p className="text-xs">Last successful call: {assistUnavailable.lastSuccessfulCall ? new Date(assistUnavailable.lastSuccessfulCall).toLocaleString() : 'none recorded'}</p>{assistUnavailable.recommendedAction ? <p className="text-sm font-medium">Recommended action: {assistUnavailable.recommendedAction}</p> : null}</div>
            </AlertBanner>
          ) : null}

          {diagnosticGroups.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Resolve the main issues first</CardTitle>
                <CardDescription>Repeated problems are grouped so you can understand the cause once instead of reading it in every row.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {diagnosticGroups.slice(0, 4).map((group) => {
                  const isError = group.diagnostic.severity === 'ERROR'
                  const Icon = isError ? AlertCircle : AlertTriangle
                  const affectsAll = group.rowNumbers.length === preview.rows.length
                  return (
                    <div key={group.key} className={cn('rounded-xl border p-4', isError ? 'border-error/20 bg-error-background' : 'border-warning/20 bg-warning-background')}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', isError ? 'text-error' : 'text-warning')} />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-foreground">{group.diagnostic.title}</p>
                              <Badge variant={isError ? 'error' : 'warning'}>
                                {affectsAll ? `All ${group.rowNumbers.length} teams` : `${group.rowNumbers.length} affected`}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-text-secondary">{group.diagnostic.explanation}</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{IMPORT_RESOLUTION_LABELS[group.diagnostic.resolution]}</p>
                            {!affectsAll ? <p className="mt-1 font-mono text-xs text-text-muted">Rows {group.rowNumbers.join(', ')}</p> : null}
                          </div>
                        </div>
                        <IssueAction diagnostic={group.diagnostic} />
                      </div>
                    </div>
                  )
                })}
                {diagnosticGroups.length > 4 ? (
                  <p className="text-sm text-text-muted">Review the team cards below for {diagnosticGroups.length - 4} additional issue {diagnosticGroups.length - 4 === 1 ? 'type' : 'types'}.</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Review teams</CardTitle>
              <CardDescription>{preview.fileName} · {preview.season.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="relative min-w-0 flex-1 xl:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search teams, students, or issues..." className="pl-9" aria-label="Search import teams" />
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Filter import teams">
                  {FILTERS.map((option) => (
                    <Button key={option.value} type="button" size="sm" variant={filter === option.value ? 'default' : 'outline'} onClick={() => setFilter(option.value)} aria-pressed={filter === option.value}>
                      {option.label} <span className="ml-1 font-mono">{filterCounts[option.value]}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {filteredRows.length > 0 ? (
                <div className="space-y-4" aria-live="polite">
                  {filteredRows.map((row) => <div id={`roster-row-${row.rowNumber}`} key={row.rowNumber}><RosterRow row={row} overrides={overrides} suggestions={repairSuggestions} decisionsDisabled={previewLoading || confirmLoading || assistLoading} onSuggestion={decideRepair} onSave={saveOverrides} onReset={() => void resetRow(row.rowNumber)} onToggleExcluded={(excluded) => void toggleExcluded(row.rowNumber, excluded)}/></div>)}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border py-12 text-center">
                  <Search className="mx-auto h-6 w-6 text-text-muted" />
                  <p className="mt-3 font-medium text-foreground">No teams match this view</p>
                  <p className="mt-1 text-sm text-text-secondary">Clear the search or select a different status filter.</p>
                  <Button className="mt-4" variant="outline" onClick={() => { setSearchQuery(''); setFilter('ALL') }}>Show all teams</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="sticky bottom-4 z-20 rounded-xl border border-border bg-card/95 p-4 shadow-popover backdrop-blur supports-[backdrop-filter]:bg-card/90">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-foreground">
                  {preview.summary.validRows} {preview.summary.validRows === 1 ? 'team' : 'teams'} will be imported
                </p>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {preview.summary.invalidRows} invalid · {preview.summary.excludedRows} removed. Nothing is created until you confirm.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Choose another file</Button>
                <Button variant="outline" onClick={() => void handlePreview()} disabled={previewLoading || confirmLoading}>Re-check</Button>
                {preview.summary.invalidRows > 0 ? <Button variant="outline" onClick={focusNextIssue}>Fix next issue</Button> : null}
                <Button onClick={() => setConfirmOpen(true)} disabled={preview.summary.validRows === 0 || previewLoading || confirmLoading}>
                  Confirm {preview.summary.validRows} {preview.summary.validRows === 1 ? 'team' : 'teams'}
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {result ? (
        <Card id="import-results">
          <CardHeader>
            <CardTitle>Import complete</CardTitle>
            <CardDescription>{result.summary.teamsCreated} teams created for {result.season.name}; {result.summary.skippedRows} rows skipped.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AlertBanner variant="success" title="Roster import finished">
              Created teams are available immediately. Student accounts were preserved or provisioned according to the validated preview.
            </AlertBanner>
            <div className="grid gap-4 lg:grid-cols-2">
              {result.rows.map((row) => <ResultCard key={`${row.rowNumber}-${row.teamExternalId}`} row={row} />)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Import ${preview?.summary.validRows ?? 0} ready ${(preview?.summary.validRows ?? 0) === 1 ? 'team' : 'teams'}?`}
        description={`RevME will create the valid teams for ${selectedSeason?.name ?? preview?.season.name ?? 'the selected season'}. Invalid rows will be skipped and can be corrected in a later import.`}
        confirmLabel="Confirm import"
        loading={confirmLoading}
        confirmDisabled={!preview || preview.summary.validRows === 0}
        onConfirm={handleConfirm}
      >
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-secondary p-4 text-sm sm:grid-cols-3">
          <div><p className="text-text-muted">Ready</p><p className="mt-1 font-mono text-lg font-semibold text-success">{preview?.summary.validRows ?? 0}</p></div>
          <div><p className="text-text-muted">Skipped</p><p className="mt-1 font-mono text-lg font-semibold text-error">{preview?.summary.invalidRows ?? 0}</p></div>
          <div><p className="text-text-muted">Warnings</p><p className="mt-1 font-mono text-lg font-semibold text-warning">{preview?.summary.rowsWithWarnings ?? 0}</p></div>
        </div>
      </ConfirmDialog>
    </div>
  )
}
