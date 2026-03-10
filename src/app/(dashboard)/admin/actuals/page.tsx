'use client'

import { clientLogger } from '@/lib/client-logger'
import {
  createActual,
  getActualById,
  getActuals,
  getActualsSummary,
  lockRoundActuals,
  unlockRoundActuals,
  unvoidActual,
  updateActual,
  voidActual,
} from '@/features/actuals/api'
import type { ActualRevision, ActualSummary, MarketSummary, RoundSummary } from '@/features/actuals/types'
import { getSeasonOverview } from '@/features/season/api'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AccessDenied } from '@/components/ui/access-denied'
import { usePermissions } from '@/hooks/usePermissions'
import { Upload, RefreshCw, CheckCircle, XCircle, FileSpreadsheet, Eye, Loader2 } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { SingleEntryFormData } from '@/components/admin/actuals/actuals-types'
import { ActualsUploadForm } from '@/components/admin/actuals/ActualsUploadForm'
import { ActualsBulkUpload } from '@/components/admin/actuals/ActualsBulkUpload'
import { ActualsProgressMatrix } from '@/components/admin/actuals/ActualsProgressMatrix'
import { ActualsViewer } from '@/components/admin/actuals/ActualsViewer'
import { ActualEditDialog } from '@/components/admin/actuals/ActualEditDialog'
import { ActualVoidDialog } from '@/components/admin/actuals/ActualVoidDialog'

export default function AdminActualsPage() {
  const { loading: permLoading, canPerform } = usePermissions()
  const [rounds, setRounds] = useState<RoundSummary[]>([])
  const [markets, setMarkets] = useState<MarketSummary[]>([])
  const [statusActuals, setStatusActuals] = useState<ActualSummary[]>([])
  const [pagedActuals, setPagedActuals] = useState<ActualSummary[]>([])
  const [totalActuals, setTotalActuals] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'view'>('single')
  const [bulkData, setBulkData] = useState('')
  const [seasonName, setSeasonName] = useState('')
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set())
  const [editingActual, setEditingActual] = useState<ActualSummary | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editRevisions, setEditRevisions] = useState<ActualRevision[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [unlockReason, setUnlockReason] = useState('')
  const [showUnlockModal, setShowUnlockModal] = useState<string | null>(null)
  const [voidingActual, setVoidingActual] = useState<ActualSummary | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [showVoided, setShowVoided] = useState(false)
  const [singleEntryReason, setSingleEntryReason] = useState('')
  const [bulkReason, setBulkReason] = useState('')
  const [viewSearch, setViewSearch] = useState('')
  const [viewRoundId, setViewRoundId] = useState('all')
  const [viewMarketId, setViewMarketId] = useState('all')
  const [viewMetric, setViewMetric] = useState<'all' | 'OCCUPANCY' | 'ADR'>('all')
  const [formData, setFormData] = useState<SingleEntryFormData>({
    roundId: '', marketId: '', weekOffset: '1', occupancy: '', adr: '',
  })

  const fetchData = useCallback(async () => {
    try {
      const [seasonData, actualsData, summaryData] = await Promise.all([
        getSeasonOverview(),
        getActuals({ includeVoided: showVoided, page, pageSize }),
        getActualsSummary({ includeVoided: showVoided }),
      ])
      if (seasonData.season) {
        setMarkets(seasonData.season.markets?.map((sm) => sm.market) || [])
        setSeasonName(seasonData.season.name || '')
      }
      setPagedActuals(actualsData.actuals || [])
      setRounds(actualsData.rounds || [])
      setTotalActuals(actualsData.totalActuals || 0)
      setStatusActuals(summaryData.actuals || [])
    } catch (err) {
      clientLogger.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }, [showVoided, page, pageSize])

  useEffect(() => {
    if (!permLoading && canPerform('actuals:upload')) fetchData()
  }, [fetchData, permLoading, canPerform])

  const actualsStatus = useMemo(() => {
    const status: { roundId: string; marketId: string; weekOffset: number; hasOccupancy: boolean; hasADR: boolean }[] = []
    rounds.forEach(round => {
      markets.forEach(market => {
        const weekOffsets = round.isFinal ? [1] : [1, 2]
        weekOffsets.forEach(weekOffset => {
          const hasOccupancy = statusActuals.some(a => a.roundId === round.id && a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'OCCUPANCY' && !a.isVoided)
          const hasADR = statusActuals.some(a => a.roundId === round.id && a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'ADR' && !a.isVoided)
          status.push({ roundId: round.id, marketId: market.id, weekOffset, hasOccupancy, hasADR })
        })
      })
    })
    return status
  }, [rounds, markets, statusActuals])

  const progressStats = useMemo(() => {
    const total = actualsStatus.length * 2
    const complete = actualsStatus.reduce((count, s) => count + (s.hasOccupancy ? 1 : 0) + (s.hasADR ? 1 : 0), 0)
    return { total, complete, percentage: total > 0 ? Math.round((complete / total) * 100) : 0 }
  }, [actualsStatus])

  const roundStats = useMemo(() => {
    const stats: Record<string, { total: number; complete: number; percentage: number }> = {}
    rounds.forEach(round => {
      const roundStatus = actualsStatus.filter(s => s.roundId === round.id)
      const total = roundStatus.length * 2
      const complete = roundStatus.reduce((count, s) => count + (s.hasOccupancy ? 1 : 0) + (s.hasADR ? 1 : 0), 0)
      stats[round.id] = { total, complete, percentage: total > 0 ? Math.round((complete / total) * 100) : 0 }
    })
    return stats
  }, [rounds, actualsStatus])

  const selectedRound = rounds.find(r => r.id === formData.roundId)
  const selectedRoundIsLocked = !!(selectedRound?.isLockedActuals || selectedRound?.lastScoredAt)
  const totalPages = Math.max(1, Math.ceil(totalActuals / pageSize))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  const filteredActuals = useMemo(() => {
    const search = viewSearch.trim().toLowerCase()
    return pagedActuals.filter((actual) => {
      if (viewRoundId !== 'all' && actual.roundId !== viewRoundId) return false
      if (viewMarketId !== 'all' && actual.marketId !== viewMarketId) return false
      if (viewMetric !== 'all' && actual.metric !== viewMetric) return false
      if (!search) return true
      return [actual.marketName, actual.metric, `R${actual.roundNumber}`, `W+${actual.weekOffset}`].join(' ').toLowerCase().includes(search)
    })
  }, [pagedActuals, viewSearch, viewRoundId, viewMarketId, viewMetric])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedRoundIsLocked && singleEntryReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required for locked/scored round (min 5 chars)' }); return
    }
    setSubmitting(true); setResult(null)
    try {
      const results = await Promise.allSettled([
        createActual({ roundId: formData.roundId, marketId: formData.marketId, weekOffset: parseInt(formData.weekOffset), metric: 'OCCUPANCY', value: parseFloat(formData.occupancy), source: 'MANUAL', reason: singleEntryReason || undefined }),
        createActual({ roundId: formData.roundId, marketId: formData.marketId, weekOffset: parseInt(formData.weekOffset), metric: 'ADR', value: parseFloat(formData.adr), source: 'MANUAL', reason: singleEntryReason || undefined }),
      ])
      const allSuccessful = results.every(r => r.status === 'fulfilled')
      setResult({ success: allSuccessful, message: allSuccessful ? 'Actuals saved successfully' : 'Some values failed to save' })
      if (allSuccessful) { setFormData({ ...formData, occupancy: '', adr: '' }); setSingleEntryReason(''); fetchData() }
    } catch { setResult({ success: false, message: 'An error occurred' }) }
    finally { setSubmitting(false) }
  }

  const handleBulkUpload = async () => {
    const lockedNums = rounds.filter(r => r.isLockedActuals || r.lastScoredAt).map(r => r.number)
    const lines = bulkData.trim().split('\n').filter(line => line.trim())
    const targetsLocked = lines.some(line => { const p = line.split(',').map(s => s.trim()); return p.length >= 1 && lockedNums.includes(parseInt(p[0])) })
    if (targetsLocked && bulkReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required when uploading to locked/scored rounds (min 5 chars)' }); return
    }
    setBulkSubmitting(true); setResult(null)
    try {
      let successCount = 0, errorCount = 0; const errors: string[] = []
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim())
        if (parts.length < 5) { errorCount++; errors.push(`Invalid format: ${line.substring(0, 30)}...`); continue }
        const [roundNum, marketName, weekOffset, occupancy, adr] = parts
        const round = rounds.find(r => r.number === parseInt(roundNum))
        const market = markets.find(m => m.name.toLowerCase() === marketName.toLowerCase())
        if (!round || !market) { errorCount++; errors.push(`Round/Market not found: ${roundNum}, ${marketName}`); continue }
        const reasonToSend = (round.isLockedActuals || round.lastScoredAt) ? bulkReason : undefined
        try {
          const res = await Promise.allSettled([
            createActual({ roundId: round.id, marketId: market.id, weekOffset: parseInt(weekOffset), metric: 'OCCUPANCY', value: parseFloat(occupancy), source: 'BULK', reason: reasonToSend }),
            createActual({ roundId: round.id, marketId: market.id, weekOffset: parseInt(weekOffset), metric: 'ADR', value: parseFloat(adr), source: 'BULK', reason: reasonToSend }),
          ])
          if (res.every(r => r.status === 'fulfilled')) successCount++; else { errorCount++; errors.push(`Row ${roundNum}/${marketName}: Failed`) }
        } catch { errorCount++; errors.push(`Row ${roundNum}/${marketName}: Error`) }
      }
      let message = `Processed ${successCount + errorCount} rows: ${successCount} successful, ${errorCount} errors`
      if (errors.length > 0 && errors.length <= 3) message += ` - ${errors.join('; ')}`
      setResult({ success: errorCount === 0, message })
      if (successCount > 0) { setBulkReason(''); fetchData() }
    } catch { setResult({ success: false, message: 'Bulk upload failed' }) }
    finally { setBulkSubmitting(false) }
  }

  const toggleRound = (roundId: string) => {
    const next = new Set(expandedRounds)
    if (next.has(roundId)) next.delete(roundId); else next.add(roundId)
    setExpandedRounds(next)
  }

  const handleLockRound = async (roundId: string) => {
    setActionLoading(roundId)
    try { await lockRoundActuals(roundId); fetchData(); setResult({ success: true, message: 'Round actuals locked' }) }
    catch { setResult({ success: false, message: 'Failed to lock round' }) }
    finally { setActionLoading(null) }
  }

  const handleUnlockRound = async () => {
    if (!showUnlockModal) return
    if (unlockReason.trim().length < 5) { setResult({ success: false, message: 'Reason must be at least 5 characters' }); return }
    setActionLoading(showUnlockModal)
    try { await unlockRoundActuals(showUnlockModal, unlockReason); fetchData(); setResult({ success: true, message: 'Round actuals unlocked' }); setShowUnlockModal(null); setUnlockReason('') }
    catch { setResult({ success: false, message: 'Failed to unlock round' }) }
    finally { setActionLoading(null) }
  }

  const openEditDrawer = async (actual: ActualSummary) => {
    setEditingActual(actual); setEditValue(actual.value.toFixed(2)); setEditReason(''); setEditRevisions([])
    try { const data = await getActualById(actual.id); setEditRevisions(data.actual.revisions || []) }
    catch (err) { clientLogger.error('Failed to load revisions:', err); toast.error('Failed to load revision history') }
  }

  const handleUpdateActual = async () => {
    if (!editingActual) return
    const round = rounds.find(r => r.id === editingActual.roundId)
    if ((round?.isLockedActuals || round?.lastScoredAt) && editReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required for editing locked/scored round actuals (min 5 chars)' }); return
    }
    setActionLoading(editingActual.id)
    try { await updateActual(editingActual.id, { value: parseFloat(editValue), reason: editReason || undefined }); fetchData(); setResult({ success: true, message: 'Actual updated' }); setEditingActual(null) }
    catch (err) { setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to update actual' }) }
    finally { setActionLoading(null) }
  }

  const handleVoidActual = async () => {
    if (!voidingActual) return
    const round = rounds.find(r => r.id === voidingActual.roundId)
    if ((round?.isLockedActuals || round?.lastScoredAt) && voidReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required for voiding locked/scored round actuals (min 5 chars)' }); return
    }
    setActionLoading(voidingActual.id)
    try { await voidActual(voidingActual.id, { reason: voidReason || undefined }); fetchData(); setResult({ success: true, message: 'Actual voided' }); setVoidingActual(null); setVoidReason('') }
    catch (err) { setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to void actual' }) }
    finally { setActionLoading(null) }
  }

  const handleUnvoidActual = async (actual: ActualSummary) => {
    const round = rounds.find(r => r.id === actual.roundId)
    if (round?.isLockedActuals || round?.lastScoredAt) { setResult({ success: false, message: 'Cannot unvoid: round is locked. Unlock first.' }); return }
    setActionLoading(actual.id)
    try { await unvoidActual(actual.id); fetchData(); setResult({ success: true, message: 'Actual restored' }) }
    catch (err) { setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to restore actual' }) }
    finally { setActionLoading(null) }
  }

  if (permLoading) return <div className="p-6 flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
  if (!canPerform('actuals:upload')) return <AccessDenied title="Access Denied" message="You do not have permission to access the Upload Actuals page. Please contact an administrator for access." />
  if (loading) return <div className="p-6 flex items-center justify-center min-h-[400px]"><div className="flex items-center gap-2 text-gray-500"><RefreshCw className="h-5 w-5 animate-spin" /><span>Loading actuals…</span></div></div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Upload Actuals</h1>
          <p className="text-gray-500 mt-1">{seasonName || 'Current Season'}</p>
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2"><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>

      {result && (
        <AlertBanner variant={result.success ? 'success' : 'error'} dismissible className="mb-4">
          {result.message}
        </AlertBanner>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                {([['single', Upload, 'Single Entry'], ['bulk', FileSpreadsheet, 'Bulk Upload'], ['view', Eye, 'View Actuals']] as const).map(([key, Icon, label]) => (
                  <button key={key} onClick={() => setActiveTab(key)} className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === key ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                    <Icon className="h-4 w-4 inline mr-2" />{label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'single' && (
                <ActualsUploadForm rounds={rounds} markets={markets} formData={formData} setFormData={setFormData} singleEntryReason={singleEntryReason} setSingleEntryReason={setSingleEntryReason} submitting={submitting} onSubmit={handleSubmit} selectedRoundIsLocked={selectedRoundIsLocked} />
              )}
              {activeTab === 'bulk' && (
                <ActualsBulkUpload rounds={rounds} markets={markets} bulkData={bulkData} setBulkData={setBulkData} bulkReason={bulkReason} setBulkReason={setBulkReason} bulkSubmitting={bulkSubmitting} onSubmit={handleBulkUpload} seasonName={seasonName} />
              )}
              {activeTab === 'view' && (
                <ActualsViewer filteredActuals={filteredActuals} rounds={rounds} markets={markets} viewSearch={viewSearch} setViewSearch={setViewSearch} viewRoundId={viewRoundId} setViewRoundId={setViewRoundId} viewMarketId={viewMarketId} setViewMarketId={setViewMarketId} viewMetric={viewMetric} setViewMetric={setViewMetric} showVoided={showVoided} onToggleShowVoided={(v) => { setShowVoided(v); setPage(1) }} page={page} totalPages={totalPages} totalActuals={totalActuals} setPage={setPage} actionLoading={actionLoading} onEdit={openEditDrawer} onVoid={setVoidingActual} onUnvoid={handleUnvoidActual} />
              )}
            </CardContent>
          </Card>
        </div>
        <div>
          <ActualsProgressMatrix rounds={rounds} markets={markets} statusActuals={statusActuals} actualsStatus={actualsStatus} progressStats={progressStats} roundStats={roundStats} expandedRounds={expandedRounds} onToggleRound={toggleRound} onLockRound={handleLockRound} onShowUnlock={setShowUnlockModal} actionLoading={actionLoading} />
        </div>
      </div>

      <ActualEditDialog actual={editingActual} onClose={() => setEditingActual(null)} editValue={editValue} setEditValue={setEditValue} editReason={editReason} setEditReason={setEditReason} editRevisions={editRevisions} rounds={rounds} actionLoading={actionLoading} onSave={handleUpdateActual} />
      <ActualVoidDialog actual={voidingActual} onClose={() => { setVoidingActual(null); setVoidReason('') }} voidReason={voidReason} setVoidReason={setVoidReason} rounds={rounds} actionLoading={actionLoading} onVoid={handleVoidActual} />

      <Dialog open={!!showUnlockModal} onOpenChange={(open) => { if (!open) { setShowUnlockModal(null); setUnlockReason('') } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock Round Actuals</DialogTitle>
            <DialogDescription>This round has been scored. Unlocking allows edits but may affect leaderboard integrity. A reason is required for audit purposes.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason for unlocking</Label>
            <Textarea className="mt-1" rows={3} placeholder="Explain why this unlock is necessary..." value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUnlockModal(null); setUnlockReason('') }}>Cancel</Button>
            <Button onClick={handleUnlockRound} disabled={actionLoading === showUnlockModal || unlockReason.trim().length < 5} className="bg-amber-600 hover:bg-amber-700">{actionLoading === showUnlockModal ? 'Unlocking...' : 'Unlock'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
