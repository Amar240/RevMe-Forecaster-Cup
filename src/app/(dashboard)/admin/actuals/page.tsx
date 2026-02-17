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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AccessDenied } from '@/components/ui/access-denied'
import { usePermissions } from '@/hooks/usePermissions'
import { 
  Upload, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  FileSpreadsheet,
  Download,
  ChevronRight,
  ChevronDown,
  Lock,
  Unlock,
  Edit2,
  Trash2,
  Eye,
  RotateCcw,
  AlertTriangle,
  Clock,
  Loader2
} from 'lucide-react'

const MARKET_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Nashville CBD': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'Dubai': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Hamburg': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
}

function MarketChip({ name }: { name: string }) {
  const colors = MARKET_COLORS[name] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
      {name}
    </span>
  )
}

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
  
  const [formData, setFormData] = useState({
    roundId: '',
    marketId: '',
    weekOffset: '1',
    occupancy: '',
    adr: '',
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
    if (!permLoading && canPerform('actuals:upload')) {
      fetchData()
    }
  }, [fetchData, permLoading, canPerform])

  const actualsStatus = useMemo(() => {
    const status: { roundId: string; marketId: string; weekOffset: number; hasOccupancy: boolean; hasADR: boolean }[] = []
    
    rounds.forEach(round => {
      markets.forEach(market => {
        const weekOffsets = round.isFinal ? [1] : [1, 2]
        weekOffsets.forEach(weekOffset => {
          const hasOccupancy = statusActuals.some(
            a => a.roundId === round.id && a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'OCCUPANCY' && !a.isVoided
          )
          const hasADR = statusActuals.some(
            a => a.roundId === round.id && a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'ADR' && !a.isVoided
          )
          status.push({ roundId: round.id, marketId: market.id, weekOffset, hasOccupancy, hasADR })
        })
      })
    })
    
    return status
  }, [rounds, markets, statusActuals])

  const progressStats = useMemo(() => {
    const total = actualsStatus.length * 2
    const complete = actualsStatus.reduce((count, s) => {
      return count + (s.hasOccupancy ? 1 : 0) + (s.hasADR ? 1 : 0)
    }, 0)
    return { total, complete, percentage: total > 0 ? Math.round((complete / total) * 100) : 0 }
  }, [actualsStatus])

  const roundStats = useMemo(() => {
    const stats: Record<string, { total: number; complete: number; percentage: number }> = {}
    
    rounds.forEach(round => {
      const roundStatus = actualsStatus.filter(s => s.roundId === round.id)
      const total = roundStatus.length * 2
      const complete = roundStatus.reduce((count, s) => {
        return count + (s.hasOccupancy ? 1 : 0) + (s.hasADR ? 1 : 0)
      }, 0)
      stats[round.id] = { total, complete, percentage: total > 0 ? Math.round((complete / total) * 100) : 0 }
    })
    
    return stats
  }, [rounds, actualsStatus])

  const selectedRound = rounds.find(r => r.id === formData.roundId)
  const selectedRoundIsLocked = selectedRound?.isLockedActuals || selectedRound?.lastScoredAt
  const totalPages = Math.max(1, Math.ceil(totalActuals / pageSize))

  const filteredActuals = useMemo(() => {
    const search = viewSearch.trim().toLowerCase()
    return pagedActuals.filter((actual) => {
      if (viewRoundId !== 'all' && actual.roundId !== viewRoundId) return false
      if (viewMarketId !== 'all' && actual.marketId !== viewMarketId) return false
      if (viewMetric !== 'all' && actual.metric !== viewMetric) return false
      if (!search) return true
      const haystack = [
        actual.marketName,
        actual.metric,
        `R${actual.roundNumber}`,
        `W+${actual.weekOffset}`,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }, [pagedActuals, viewSearch, viewRoundId, viewMarketId, viewMetric])

  // eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (selectedRoundIsLocked && singleEntryReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required for locked/scored round (min 5 chars)' })
      return
    }
    
    setSubmitting(true)
    setResult(null)

    try {
      const occupancyValue = parseFloat(formData.occupancy)
      const adrValue = parseFloat(formData.adr)
      
      const results = await Promise.allSettled([
        createActual({
          roundId: formData.roundId,
          marketId: formData.marketId,
          weekOffset: parseInt(formData.weekOffset),
          metric: 'OCCUPANCY',
          value: occupancyValue,
          source: 'MANUAL',
          reason: singleEntryReason || undefined,
        }),
        createActual({
          roundId: formData.roundId,
          marketId: formData.marketId,
          weekOffset: parseInt(formData.weekOffset),
          metric: 'ADR',
          value: adrValue,
          source: 'MANUAL',
          reason: singleEntryReason || undefined,
        }),
      ])

      const allSuccessful = results.every(r => r.status === 'fulfilled')
      setResult({
        success: allSuccessful,
        message: allSuccessful ? 'Actuals saved successfully' : 'Some values failed to save',
      })

      if (allSuccessful) {
        setFormData({ ...formData, occupancy: '', adr: '' })
        setSingleEntryReason('')
        fetchData()
      }
    } catch {
      setResult({ success: false, message: 'An error occurred' })
    } finally {
      setSubmitting(false)
    }
  }

  const getLockedRoundNumbers = () => {
    return rounds.filter(r => r.isLockedActuals || r.lastScoredAt).map(r => r.number)
  }

  const getBulkDataTargetsLockedRound = () => {
    if (!bulkData.trim()) return false
    const lockedNums = getLockedRoundNumbers()
    const lines = bulkData.trim().split('\n').filter(line => line.trim())
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim())
      if (parts.length >= 1) {
        const roundNum = parseInt(parts[0])
        if (lockedNums.includes(roundNum)) return true
      }
    }
    return false
  }

  const handleBulkUpload = async () => {
    const targetsLocked = getBulkDataTargetsLockedRound()
    if (targetsLocked && bulkReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required when uploading to locked/scored rounds (min 5 chars)' })
      return
    }
    
    setBulkSubmitting(true)
    setResult(null)
    
    try {
      const lines = bulkData.trim().split('\n').filter(line => line.trim())
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []
      
      for (const line of lines) {
        const parts = line.split(',').map(p => p.trim())
        if (parts.length < 5) {
          errorCount++
          errors.push(`Invalid format: ${line.substring(0, 30)}...`)
          continue
        }
        
        const [roundNum, marketName, weekOffset, occupancy, adr] = parts
        const round = rounds.find(r => r.number === parseInt(roundNum))
        const market = markets.find(m => m.name.toLowerCase() === marketName.toLowerCase())
        
        if (!round || !market) {
          errorCount++
          errors.push(`Round/Market not found: ${roundNum}, ${marketName}`)
          continue
        }
        
        const isRoundLocked = round.isLockedActuals || round.lastScoredAt
        const reasonToSend = isRoundLocked ? bulkReason : undefined
        
        try {
          const results = await Promise.allSettled([
            createActual({
              roundId: round.id,
              marketId: market.id,
              weekOffset: parseInt(weekOffset),
              metric: 'OCCUPANCY',
              value: parseFloat(occupancy),
              source: 'BULK',
              reason: reasonToSend,
            }),
            createActual({
              roundId: round.id,
              marketId: market.id,
              weekOffset: parseInt(weekOffset),
              metric: 'ADR',
              value: parseFloat(adr),
              source: 'BULK',
              reason: reasonToSend,
            }),
          ])
          
          if (results.every(r => r.status === 'fulfilled')) {
            successCount++
          } else {
            errorCount++
            errors.push(`Row ${roundNum}/${marketName}: Failed`)
          }
        } catch {
          errorCount++
          errors.push(`Row ${roundNum}/${marketName}: Error`)
        }
      }
      
      let message = `Processed ${successCount + errorCount} rows: ${successCount} successful, ${errorCount} errors`
      if (errors.length > 0 && errors.length <= 3) {
        message += ` - ${errors.join('; ')}`
      }
      
      setResult({
        success: errorCount === 0,
        message,
      })
      
      if (successCount > 0) {
        setBulkReason('')
        fetchData()
      }
    } catch {
      setResult({ success: false, message: 'Bulk upload failed' })
    } finally {
      setBulkSubmitting(false)
    }
  }

  const generateTemplate = () => {
    let csv = 'Round,Market,WeekOffset,Occupancy,ADR($)\n'
    rounds.forEach(round => {
      markets.forEach(market => {
        const weekOffsets = round.isFinal ? [1] : [1, 2]
        weekOffsets.forEach(weekOffset => {
          csv += `${round.number},${market.name},${weekOffset},,\n`
        })
      })
    })
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `actuals-template-${seasonName || 'season'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toggleRound = (roundId: string) => {
    const newExpanded = new Set(expandedRounds)
    if (newExpanded.has(roundId)) {
      newExpanded.delete(roundId)
    } else {
      newExpanded.add(roundId)
    }
    setExpandedRounds(newExpanded)
  }

  const handleLockRound = async (roundId: string) => {
    setActionLoading(roundId)
    try {
      await lockRoundActuals(roundId)
      fetchData()
      setResult({ success: true, message: 'Round actuals locked' })
    } catch {
      setResult({ success: false, message: 'Failed to lock round' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnlockRound = async () => {
    if (!showUnlockModal) return
    if (unlockReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason must be at least 5 characters' })
      return
    }
    
    setActionLoading(showUnlockModal)
    try {
      await unlockRoundActuals(showUnlockModal, unlockReason)
      fetchData()
      setResult({ success: true, message: 'Round actuals unlocked' })
      setShowUnlockModal(null)
      setUnlockReason('')
    } catch {
      setResult({ success: false, message: 'Failed to unlock round' })
    } finally {
      setActionLoading(null)
    }
  }

  const openEditDrawer = async (actual: ActualSummary) => {
    setEditingActual(actual)
    setEditValue(actual.value.toFixed(2))
    setEditReason('')
    setEditRevisions([])
    
    try {
      const data = await getActualById(actual.id)
      setEditRevisions(data.actual.revisions || [])
    } catch (err) {
      clientLogger.error('Failed to load revisions:', err)
    }
  }

  const handleUpdateActual = async () => {
    if (!editingActual) return
    
    const round = rounds.find(r => r.id === editingActual.roundId)
    const requiresReason = round?.isLockedActuals || round?.lastScoredAt
    
    if (requiresReason && editReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required for editing locked/scored round actuals (min 5 chars)' })
      return
    }
    
    setActionLoading(editingActual.id)
    try {
      const newValue = parseFloat(editValue)
      await updateActual(editingActual.id, { value: newValue, reason: editReason || undefined })
      fetchData()
      setResult({ success: true, message: 'Actual updated' })
      setEditingActual(null)
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to update actual' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleVoidActual = async () => {
    if (!voidingActual) return
    
    const round = rounds.find(r => r.id === voidingActual.roundId)
    const requiresReason = round?.isLockedActuals || round?.lastScoredAt
    
    if (requiresReason && voidReason.trim().length < 5) {
      setResult({ success: false, message: 'Reason is required for voiding locked/scored round actuals (min 5 chars)' })
      return
    }
    
    setActionLoading(voidingActual.id)
    try {
      await voidActual(voidingActual.id, { reason: voidReason || undefined })
      fetchData()
      setResult({ success: true, message: 'Actual voided' })
      setVoidingActual(null)
      setVoidReason('')
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to void actual' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnvoidActual = async (actual: ActualSummary) => {
    const round = rounds.find(r => r.id === actual.roundId)
    const requiresReason = round?.isLockedActuals || round?.lastScoredAt
    
    if (requiresReason) {
      setResult({ success: false, message: 'Cannot unvoid: round is locked. Unlock first.' })
      return
    }
    
    setActionLoading(actual.id)
    try {
      await unvoidActual(actual.id)
      fetchData()
      setResult({ success: true, message: 'Actual restored' })
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to restore actual' })
    } finally {
      setActionLoading(null)
    }
  }

  const formatValue = (value: number, metric: 'OCCUPANCY' | 'ADR') => {
    if (metric === 'OCCUPANCY') return value.toFixed(2)
    return `$${value.toFixed(2)}`
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (permLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!canPerform('actuals:upload')) {
    return <AccessDenied title="Access Denied" message="You do not have permission to access the Upload Actuals page. Please contact an administrator for access." />
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-gray-500">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Upload Actuals</h1>
          <p className="text-gray-500 mt-1">{seasonName || 'Current Season'}</p>
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {result && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {result.message}
                  <button onClick={() => setResult(null)} className="ml-auto">x</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                <button
                  onClick={() => setActiveTab('single')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'single' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Upload className="h-4 w-4 inline mr-2" />
                  Single Entry
                </button>
                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'bulk' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4 inline mr-2" />
                  Bulk Upload
                </button>
                <button
                  onClick={() => setActiveTab('view')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'view' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Eye className="h-4 w-4 inline mr-2" />
                  View Actuals
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'single' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Round</Label>
                      <select
                        className="w-full mt-1 p-2 border rounded-md"
                        value={formData.roundId}
                        onChange={(e) => setFormData({ ...formData, roundId: e.target.value })}
                        required
                      >
                        <option value="">Select round</option>
                        {rounds.map((r) => (
                          <option key={r.id} value={r.id}>
                            Round {r.number}{r.isFinal ? ' (Final)' : ''}
                            {r.isLockedActuals ? ' (locked)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Market</Label>
                      <select
                        className="w-full mt-1 p-2 border rounded-md"
                        value={formData.marketId}
                        onChange={(e) => setFormData({ ...formData, marketId: e.target.value })}
                        required
                      >
                        <option value="">Select market</option>
                        {markets.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <Label>Search</Label>
                      <Input
                        value={viewSearch}
                        onChange={(e) => setViewSearch(e.target.value)}
                        placeholder="Search market, metric, round, week"
                      />
                    </div>
                    <div>
                      <Label>Round</Label>
                      <select
                        className="w-full mt-1 border rounded-md px-2 py-2 text-sm"
                        value={viewRoundId}
                        onChange={(e) => setViewRoundId(e.target.value)}
                      >
                        <option value="all">All rounds</option>
                        {rounds.map((round) => (
                          <option key={round.id} value={round.id}>
                            Round {round.number}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Market</Label>
                      <select
                        className="w-full mt-1 border rounded-md px-2 py-2 text-sm"
                        value={viewMarketId}
                        onChange={(e) => setViewMarketId(e.target.value)}
                      >
                        <option value="all">All markets</option>
                        {markets.map((market) => (
                          <option key={market.id} value={market.id}>
                            {market.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Metric</Label>
                      <select
                        className="w-full mt-1 border rounded-md px-2 py-2 text-sm"
                        value={viewMetric}
                        onChange={(e) => setViewMetric(e.target.value as 'all' | 'OCCUPANCY' | 'ADR')}
                      >
                        <option value="all">All metrics</option>
                        <option value="OCCUPANCY">Occupancy</option>
                        <option value="ADR">ADR</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setViewSearch('')
                          setViewRoundId('all')
                          setViewMarketId('all')
                          setViewMetric('all')
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Week Offset</Label>
                    <select
                      className="w-full mt-1 p-2 border rounded-md"
                      value={formData.weekOffset}
                      onChange={(e) => setFormData({ ...formData, weekOffset: e.target.value })}
                      required
                    >
                      <option value="1">Week +1</option>
                      <option value="2">Week +2</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Occupancy</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="e.g., 72.5"
                        value={formData.occupancy}
                        onChange={(e) => setFormData({ ...formData, occupancy: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>ADR ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g., 145.00"
                        value={formData.adr}
                        onChange={(e) => setFormData({ ...formData, adr: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  {selectedRoundIsLocked && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Label className="text-amber-700 text-sm font-medium">
                        Reason (required - round is locked/scored)
                      </Label>
                      <textarea
                        className="w-full mt-1 p-2 border border-amber-200 rounded-md text-sm"
                        rows={2}
                        placeholder="Explain why this change is needed..."
                        value={singleEntryReason}
                        onChange={(e) => setSingleEntryReason(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <Button type="submit" disabled={submitting} className="w-full bg-green-600 hover:bg-green-700">
                    {submitting ? (
                      <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                    ) : (
                      <><Check className="h-4 w-4 mr-2" /> Save Actual</>
                    )}
                  </Button>
                </form>
              )}

              {activeTab === 'bulk' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Upload multiple actuals at once using CSV format
                    </p>
                    <Button variant="outline" size="sm" onClick={generateTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                  
                  <div>
                    <Label>CSV Data</Label>
                    <textarea
                      className="w-full mt-1 p-3 border rounded-md font-mono text-sm h-48"
                      placeholder="Round,Market,WeekOffset,Occupancy,ADR($)&#10;1,Nashville CBD,1,72.5,145.00&#10;1,Nashville CBD,2,74.0,148.50"
                      value={bulkData}
                      onChange={(e) => setBulkData(e.target.value)}
                    />
                  </div>
                  
                  {getBulkDataTargetsLockedRound() && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Label className="text-amber-700 text-sm font-medium">
                        Reason (required - your data targets locked/scored rounds)
                      </Label>
                      <textarea
                        className="w-full mt-1 p-2 border border-amber-200 rounded-md text-sm"
                        rows={2}
                        placeholder="Explain why this bulk upload is needed..."
                        value={bulkReason}
                        onChange={(e) => setBulkReason(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <Button onClick={handleBulkUpload} disabled={bulkSubmitting || !bulkData.trim()} className="w-full">
                    {bulkSubmitting ? (
                      <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Processing...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" /> Upload Actuals</>
                    )}
                  </Button>
                </div>
              )}

              {activeTab === 'view' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      View and manage all uploaded actuals
                    </p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={showVoided}
                        onChange={(e) => {
                          setShowVoided(e.target.checked)
                          setPage(1)
                        }}
                        className="rounded"
                      />
                      Show voided
                    </label>
                  </div>
                  
                  {filteredActuals.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No actuals match your filters</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="max-h-[400px] overflow-y-auto border rounded-md">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium">Round</th>
                              <th className="px-3 py-2 text-left font-medium">Market</th>
                              <th className="px-3 py-2 text-left font-medium">Week</th>
                              <th className="px-3 py-2 text-left font-medium">Metric</th>
                              <th className="px-3 py-2 text-right font-medium">Value</th>
                              <th className="px-3 py-2 text-center font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {filteredActuals.map((actual) => (
                              <tr 
                                key={actual.id} 
                                className={actual.isVoided ? 'bg-red-50 opacity-60' : 'hover:bg-gray-50'}
                              >
                                <td className="px-3 py-2">R{actual.roundNumber}</td>
                                <td className="px-3 py-2">
                                  <MarketChip name={actual.marketName} />
                                </td>
                                <td className="px-3 py-2">W+{actual.weekOffset}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    actual.metric === 'OCCUPANCY' 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {actual.metric}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {actual.isVoided ? (
                                    <span className="line-through">{formatValue(actual.value, actual.metric)}</span>
                                  ) : (
                                    formatValue(actual.value, actual.metric)
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {actual.isVoided ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUnvoidActual(actual)}
                                      disabled={actionLoading === actual.id}
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                    </Button>
                                  ) : (
                                    <div className="flex gap-1 justify-center">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditDrawer(actual)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setVoidingActual(actual)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
                        <span>
                          Page {page} of {totalPages} � {totalActuals} total
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                            disabled={page <= 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                            disabled={page >= totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Upload Status
              </CardTitle>
              <CardDescription>Track which actuals have been entered for each round</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Progress</span>
                  <span className="font-medium">{progressStats.complete}/{progressStats.total}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${progressStats.percentage}%` }}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                {rounds.map((round) => {
                  const stats = roundStats[round.id] || { total: 0, complete: 0, percentage: 0 }
                  const isExpanded = expandedRounds.has(round.id)
                  const roundActuals = statusActuals.filter(a => a.roundId === round.id && !a.isVoided)
                  
                  return (
                    <div key={round.id} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleRound(round.id)}
                        className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium">
                            Round {round.number}{round.isFinal ? ' (Final)' : ''}
                          </span>
                          <div className="flex gap-1">
                            {round.isLockedActuals && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                                <Lock className="h-3 w-3" />
                                Locked
                              </span>
                            )}
                            {round.scoresStale && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                                <AlertTriangle className="h-3 w-3" />
                                Stale
                              </span>
                            )}
                            {round.lastScoredAt && !round.scoresStale && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                <CheckCircle className="h-3 w-3" />
                                Scored
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-300 ${
                                stats.percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${stats.percentage}%` }}
                            />
                          </div>
                          <span className={`text-sm font-medium ${
                            stats.percentage === 100 ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {stats.complete}/{stats.total}
                          </span>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="border-t bg-gray-50 p-3">
                          <div className="flex gap-2 mb-3">
                            {round.isLockedActuals ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowUnlockModal(round.id)}
                                disabled={actionLoading === round.id}
                                className="text-amber-600 border-amber-200 hover:bg-amber-50"
                              >
                                <Unlock className="h-4 w-4 mr-1" />
                                Unlock (Override)
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleLockRound(round.id)}
                                disabled={actionLoading === round.id}
                              >
                                <Lock className="h-4 w-4 mr-1" />
                                Lock Actuals
                              </Button>
                            )}
                            {round.lastScoredAt && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last scored: {formatDate(round.lastScoredAt)}
                              </span>
                            )}
                          </div>
                          
                          {roundActuals.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-2">No actuals entered</p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              {markets.map((market) => {
                                const weekOffsets = round.isFinal ? [1] : [1, 2]
                                return weekOffsets.map((weekOffset) => {
                                  const occ = roundActuals.find(
                                    a => a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'OCCUPANCY'
                                  )
                                  const adr = roundActuals.find(
                                    a => a.marketId === market.id && a.weekOffset === weekOffset && a.metric === 'ADR'
                                  )
                                  const hasData = occ || adr
                                  
                                  return (
                                    <div 
                                      key={`${market.id}-${weekOffset}`}
                                      className={`p-2 rounded border ${
                                        hasData ? 'bg-white border-green-200' : 'bg-gray-100 border-gray-200'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <MarketChip name={market.name} />
                                        <span className="text-gray-500">W+{weekOffset}</span>
                                      </div>
                                      {hasData ? (
                                        <div className="text-gray-600">
                                          {occ && <div>Occ: {occ.value.toFixed(2)}</div>}
                                          {adr && <div>ADR: ${adr.value.toFixed(2)}</div>}
                                        </div>
                                      ) : (
                                        <div className="text-gray-400">Not entered</div>
                                      )}
                                    </div>
                                  )
                                })
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {editingActual && (
        <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
          <div className="w-96 bg-white h-full overflow-y-auto shadow-xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Edit Actual</h2>
              <button onClick={() => setEditingActual(null)} className="text-gray-500 hover:text-gray-700">x</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-600">
                <div className="flex gap-2 mb-2">
                  <MarketChip name={editingActual.marketName} />
                  <span className="px-2 py-0.5 rounded bg-gray-100">Round {editingActual.roundNumber}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100">W+{editingActual.weekOffset}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  editingActual.metric === 'OCCUPANCY' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {editingActual.metric}
                </span>
              </div>
              
              <div>
                <Label>{editingActual.metric === 'OCCUPANCY' ? 'Occupancy' : 'ADR ($)'}</Label>
                <Input
                  type="number"
                  step={editingActual.metric === 'OCCUPANCY' ? '0.1' : '0.01'}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              </div>
              
              {(rounds.find(r => r.id === editingActual.roundId)?.isLockedActuals ||
                rounds.find(r => r.id === editingActual.roundId)?.lastScoredAt) && (
                <div>
                  <Label className="text-amber-600">Reason (required for locked/scored round)</Label>
                  <textarea
                    className="w-full mt-1 p-2 border rounded-md text-sm"
                    rows={2}
                    placeholder="Explain why this change is needed..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                  />
                </div>
              )}
              
              <Button 
                onClick={handleUpdateActual} 
                disabled={actionLoading === editingActual.id}
                className="w-full"
              >
                {actionLoading === editingActual.id ? (
                  <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                ) : (
                  'Save Changes'
                )}
              </Button>
              
              {editRevisions.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="font-medium text-sm mb-2">Audit History</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {editRevisions.map((rev) => (
                      <div key={rev.id} className="text-xs p-2 bg-gray-50 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`px-1.5 py-0.5 rounded ${
                            rev.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                            rev.action === 'EDIT' ? 'bg-blue-100 text-blue-700' :
                            rev.action === 'VOID' ? 'bg-red-100 text-red-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {rev.action}
                          </span>
                          <span className="text-gray-500">{formatDate(rev.createdAt)}</span>
                        </div>
                        <div className="text-gray-600">
                          {rev.oldValue !== null && rev.newValue !== null && (
                            <span>{rev.oldValue} {'->'} {rev.newValue}</span>
                          )}
                          {rev.oldValue === null && rev.newValue !== null && (
                            <span>Created: {rev.newValue}</span>
                          )}
                          {rev.oldValue !== null && rev.newValue === null && (
                            <span>Voided from: {rev.oldValue}</span>
                          )}
                        </div>
                        <div className="text-gray-500 mt-1">by {rev.actor}</div>
                        {rev.reason && (
                          <div className="text-gray-600 mt-1 italic">&quot;{rev.reason}&quot;</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h2 className="font-semibold text-lg mb-2">Unlock Round Actuals</h2>
            <p className="text-sm text-gray-600 mb-4">
              This round has been scored. Unlocking allows edits but may affect leaderboard integrity.
              A reason is required for audit purposes.
            </p>
            <div className="mb-4">
              <Label>Reason for unlocking</Label>
              <textarea
                className="w-full mt-1 p-2 border rounded-md text-sm"
                rows={3}
                placeholder="Explain why this unlock is necessary..."
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setShowUnlockModal(null); setUnlockReason('') }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleUnlockRound}
                disabled={actionLoading === showUnlockModal || unlockReason.trim().length < 5}
                className="flex-1 bg-amber-600 hover:bg-amber-700"
              >
                {actionLoading === showUnlockModal ? 'Unlocking...' : 'Unlock'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {voidingActual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h2 className="font-semibold text-lg mb-2">Void Actual</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will soft-delete the actual value. It can be restored later if needed.
            </p>
            <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
              <div className="flex gap-2 mb-1">
                <MarketChip name={voidingActual.marketName} />
                <span>{voidingActual.metric}</span>
              </div>
              <div className="font-medium">
                Round {voidingActual.roundNumber}, W+{voidingActual.weekOffset}: {formatValue(voidingActual.value, voidingActual.metric)}
              </div>
            </div>
            {(rounds.find(r => r.id === voidingActual.roundId)?.isLockedActuals ||
              rounds.find(r => r.id === voidingActual.roundId)?.lastScoredAt) && (
              <div className="mb-4">
                <Label className="text-amber-600">Reason (required)</Label>
                <textarea
                  className="w-full mt-1 p-2 border rounded-md text-sm"
                  rows={2}
                  placeholder="Explain why this void is necessary..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => { setVoidingActual(null); setVoidReason('') }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleVoidActual}
                disabled={actionLoading === voidingActual.id}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {actionLoading === voidingActual.id ? 'Voiding...' : 'Void Actual'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






