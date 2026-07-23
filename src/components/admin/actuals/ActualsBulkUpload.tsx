'use client'

import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, RotateCcw, Trash2, Undo2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import type { ActualImportOverride, ActualImportPreview, ActualImportRow, MarketSummary, RoundSummary } from '@/features/actuals/types'
import { confirmActualsFile, previewActualsFile } from '@/features/actuals/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertBanner } from '@/components/ui/alert-banner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ActualsBulkUploadProps {
  rounds: RoundSummary[]
  markets: MarketSummary[]
  seasonName: string
  onImported: () => void
}

function actionBadge(action: ActualImportRow['occupancyAction']) {
  if (action === 'CREATE') return <Badge variant="success">New</Badge>
  if (action === 'REPLACE') return <Badge variant="warning">Replace</Badge>
  if (action === 'UNCHANGED') return <Badge variant="neutral">Unchanged</Badge>
  return <Badge variant="error">Invalid</Badge>
}

export function ActualsBulkUpload({ rounds, markets, seasonName, onImported }: ActualsBulkUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ActualImportPreview | null>(null)
  const [overrides, setOverrides] = useState<ActualImportOverride[]>([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)

  const reset = () => {
    setFile(null); setPreview(null); setOverrides([]); setReason(''); setError(''); setConfirmOpen(false)
    if (inputRef.current) inputRef.current.value = ''
  }
  const openPicker = () => {
    if (!inputRef.current) return
    inputRef.current.value = ''
    inputRef.current.click()
  }
  const selectFile = (next: File | null) => {
    if (!next) return
    if (!next.name.toLowerCase().endsWith('.csv')) return toast.error('Choose a .csv actuals template file')
    reset()
    setFile(next)
  }
  const runPreview = async (nextOverrides = overrides) => {
    if (!file) return
    setLoading(true); setError('')
    try {
      const next = await previewActualsFile(file, nextOverrides)
      setPreview(next)
      return next
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not preview this CSV file')
    } finally {
      setLoading(false)
    }
  }
  const updateRow = async (row: ActualImportRow, values: { occupancy?: number; adr?: number; excluded?: boolean }) => {
    const current = overrides.find((item) => item.rowNumber === row.rowNumber) ?? { rowNumber: row.rowNumber }
    const nextEntry = { ...current, ...values }
    const next = [...overrides.filter((item) => item.rowNumber !== row.rowNumber), nextEntry]
    setOverrides(next)
    await runPreview(next)
  }
  const resetRow = async (rowNumber: number) => {
    const next = overrides.filter((item) => item.rowNumber !== rowNumber)
    setOverrides(next)
    await runPreview(next)
  }
  const prepareConfirm = async () => {
    const checked = await runPreview()
    if (!checked || checked.summary.invalidRows || !checked.summary.readyRows) return
    setConfirmOpen(true)
  }
  const confirm = async () => {
    if (!file || !preview) return
    setLoading(true); setError('')
    try {
      const result = await confirmActualsFile(file, preview.fileHash, overrides, reason || undefined)
      toast.success(result.message)
      setConfirmOpen(false)
      reset()
      onImported()
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Actuals import failed')
    } finally {
      setLoading(false)
    }
  }
  const generateTemplate = () => {
    let csv = 'Round,Market,WeekOffset,Occupancy,ADR($)\n'
    rounds.forEach((round) => markets.forEach((market) => (round.isFinal ? [1] : [1, 2]).forEach((weekOffset) => { csv += `${round.number},${market.name},${weekOffset},,\n` })))
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `actuals-template-${seasonName || 'season'}.csv`; anchor.click()
    URL.revokeObjectURL(url)
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-text-secondary">Complete the CSV template, then upload it for review before anything is saved.</p>
      <Button variant="outline" size="sm" onClick={generateTemplate}><Download className="mr-2 h-4 w-4"/>Download Template</Button>
    </div>

    {error && <AlertBanner variant="error"><div className="space-y-2"><p className="font-medium">We could not process this actuals file</p><p>{error}</p><Button variant="outline" size="sm" onClick={openPicker}>Choose another file</Button></div></AlertBanner>}

    {!preview && <div className="space-y-3">
      <button type="button" onClick={openPicker} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0] ?? null) }} className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-secondary p-6 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <UploadCloud className="mb-3 h-10 w-10 text-primary"/>
        <strong>{file?.name ?? 'Drop the completed CSV template here'}</strong>
        <span className="mt-1 text-sm text-text-secondary">or choose a file</span>
        <span className="mt-2 text-xs text-text-muted">CSV only · maximum 2 MB · no values are saved during preview</span>
      </button>
      <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0] ?? null)}/>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!file || loading} onClick={() => void runPreview()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileSpreadsheet className="mr-2 h-4 w-4"/>}Preview actuals</Button>
        {file && <Button variant="outline" disabled={loading} onClick={openPicker}>Choose another file</Button>}
      </div>
    </div>}

    {preview && <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-secondary p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{preview.fileName}</p><p className="text-sm text-text-secondary tabular-nums">{preview.summary.readyRows} ready · {preview.summary.invalidRows} invalid · {preview.summary.excludedRows} removed</p></div><Button variant="outline" size="sm" disabled={loading} onClick={() => { reset(); queueMicrotask(openPicker) }}>Choose another file</Button></div>
        <div className="mt-3 flex flex-wrap gap-2"><Badge variant="success">{preview.summary.newValues} new values</Badge><Badge variant="warning">{preview.summary.changedValues} replacements</Badge><Badge variant="neutral">{preview.summary.unchangedValues} unchanged</Badge></div>
      </div>

      <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
        {preview.rows.map((row) => <ActualPreviewRow key={`${row.rowNumber}:${row.occupancy}:${row.adr}:${row.excluded}`} row={row} loading={loading} overridden={overrides.some((item) => item.rowNumber === row.rowNumber)} onSave={(values) => void updateRow(row, values)} onReset={() => void resetRow(row.rowNumber)}/>)}
      </div>

      {preview.summary.lockedRows > 0 && <div className="rounded-lg border border-warning/30 bg-warning-background p-3"><Label htmlFor="actual-import-reason">Reason required for locked or scored rounds</Label><Textarea id="actual-import-reason" className="mt-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why these actuals must be added or replaced (minimum 5 characters)."/></div>}

      <div className="sticky bottom-3 rounded-xl border border-border bg-surface p-4 shadow-lg"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-display font-semibold">{preview.summary.readyRows} rows ready to confirm</p><p className="text-sm text-text-secondary">{preview.summary.newValues} new · {preview.summary.changedValues} replacements · {preview.summary.unchangedValues} unchanged</p></div><div className="flex flex-col-reverse gap-2 sm:flex-row"><Button variant="outline" disabled={loading} onClick={() => void runPreview()}><RefreshCw className="mr-2 h-4 w-4"/>Re-check</Button><Button disabled={loading || preview.summary.invalidRows > 0 || preview.summary.readyRows === 0 || (preview.summary.lockedRows > 0 && reason.trim().length < 5)} onClick={() => void prepareConfirm()}>Review and confirm</Button></div></div></div>
    </div>}

    <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Import these actuals?" description={`${preview?.summary.newValues ?? 0} values will be created, ${preview?.summary.changedValues ?? 0} existing values will be replaced, and ${preview?.summary.unchangedValues ?? 0} unchanged values will be skipped. Replacements are recorded in revision history.`} confirmLabel="Import actuals" loading={loading} onConfirm={confirm}/>
  </div>
}

function ActualPreviewRow({ row, loading, overridden, onSave, onReset }: { row: ActualImportRow; loading: boolean; overridden: boolean; onSave: (values: { occupancy?: number; adr?: number; excluded?: boolean }) => void; onReset: () => void }) {
  const [occupancy, setOccupancy] = useState(row.occupancy?.toString() ?? '')
  const [adr, setAdr] = useState(row.adr?.toString() ?? '')
  if (row.excluded) return <div className="rounded-lg border border-dashed border-border bg-surface-secondary p-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-text-secondary">Row {row.rowNumber} · Round {row.roundNumber} · {row.marketName}</p><Badge variant="neutral">Removed</Badge></div><Button className="mt-2" variant="outline" size="sm" disabled={loading} onClick={() => onSave({ excluded: false })}><Undo2 className="mr-2 h-4 w-4"/>Restore row</Button></div>

  return <div className="rounded-lg border border-border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">Round {row.roundNumber ?? '—'} · {row.marketName || 'Unknown market'} · Week +{row.weekOffset ?? '—'}</p><p className="font-mono text-xs text-text-muted">CSV row {row.rowNumber}</p></div>{row.valid ? <Badge variant={row.warnings.length ? 'warning' : 'success'}>{row.warnings.length ? 'Warning' : 'Ready'}</Badge> : <Badge variant="error">Error</Badge>}</div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="text-sm"><span className="flex items-center justify-between gap-2"><span className="font-medium">Occupancy</span>{actionBadge(row.occupancyAction)}</span><Input className="mt-1 tabular-nums" type="number" min="0" max="100" step="0.1" value={occupancy} onChange={(event) => setOccupancy(event.target.value)}/>{row.existingOccupancy !== null && <span className="mt-1 block text-xs text-text-muted">Current: {row.existingOccupancy}</span>}</label>
      <label className="text-sm"><span className="flex items-center justify-between gap-2"><span className="font-medium">ADR ($)</span>{actionBadge(row.adrAction)}</span><Input className="mt-1 tabular-nums" type="number" min="0" step="0.01" value={adr} onChange={(event) => setAdr(event.target.value)}/>{row.existingAdr !== null && <span className="mt-1 block text-xs text-text-muted">Current: ${row.existingAdr.toFixed(2)}</span>}</label>
    </div>
    {(row.errors.length > 0 || row.warnings.length > 0) && <div className="mt-3 space-y-1">{row.errors.map((message) => <p key={message} className="flex items-start gap-2 text-sm text-error"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{message}</p>)}{row.warnings.map((message) => <p key={message} className="flex items-start gap-2 text-sm text-warning"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{message}</p>)}</div>}
    <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={loading || occupancy === '' || adr === ''} onClick={() => onSave({ occupancy: Number(occupancy), adr: Number(adr) })}><CheckCircle2 className="mr-2 h-4 w-4"/>Save row</Button>{overridden && <Button size="sm" variant="outline" disabled={loading} onClick={onReset}><RotateCcw className="mr-2 h-4 w-4"/>Reset</Button>}<Button size="sm" variant="ghost" className="text-error" disabled={loading} onClick={() => onSave({ excluded: true })}><Trash2 className="mr-2 h-4 w-4"/>Remove</Button></div>
  </div>
}
