'use client'

import Link from 'next/link'
import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Plus, Trash2, ExternalLink, ChevronRight, AlertCircle, GripVertical } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Market {
  id: string
  name: string
}

interface ResourceLink {
  id: string
  label: string
  url: string
  type: string
  note: string | null
  order: number
}

interface RoundUpdate {
  id: string
  marketId?: string
  roundNumber: number
  headline: string
  whatChanged: string
  createdAt: string
  createdBy?: { firstName: string; lastName: string }
}

interface MarketInfo {
  id: string
  marketId: string
  title: string | null
  summary: string | null
  description: string | null
  demandDrivers: string[]
  supplyNotes: string[]
  risks: string[]
  strategyHints: string[]
  resourceLinks: ResourceLink[]
}

interface Season {
  id: string
  name: string
}

export default function AdminMarketInfoPage() {
  const [season, setSeason] = useState<Season | null>(null)
  const [markets, setMarkets] = useState<Market[]>([])
  const [marketInfos, setMarketInfos] = useState<MarketInfo[]>([])
  const [roundUpdates, setRoundUpdates] = useState<RoundUpdate[]>([])
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    description: '',
    demandDrivers: [''],
    supplyNotes: [''],
    risks: [''],
    strategyHints: [''],
  })

  const [newLink, setNewLink] = useState({ label: '', url: '', type: 'OTHER', note: '' })
  const [newRoundUpdate, setNewRoundUpdate] = useState({ roundNumber: 1, headline: '', whatChanged: '' })
  const [showAddLink, setShowAddLink] = useState(false)
  const [showAddRoundUpdate, setShowAddRoundUpdate] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/market-info')
      if (res.ok) {
        const data = await res.json()
        setSeason(data.season)
        setMarkets(data.markets || [])
        setMarketInfos(data.marketInfos || [])
        setRoundUpdates(data.roundUpdates || [])
        if (data.markets?.length > 0 && !selectedMarketId) {
          setSelectedMarketId(data.markets[0].id)
        }
      }
    } catch (err) {
      clientLogger.error('Failed to fetch market info:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [selectedMarketId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
    if (selectedMarketId) {
      const info = marketInfos.find((m) => m.marketId === selectedMarketId)
      if (info) {
        setFormData({
          title: info.title || '',
          summary: info.summary || '',
          description: info.description || '',
          demandDrivers: info.demandDrivers?.length > 0 ? info.demandDrivers : [''],
          supplyNotes: info.supplyNotes?.length > 0 ? info.supplyNotes : [''],
          risks: info.risks?.length > 0 ? info.risks : [''],
          strategyHints: info.strategyHints?.length > 0 ? info.strategyHints : [''],
        })
      } else {
        setFormData({
          title: '',
          summary: '',
          description: '',
          demandDrivers: [''],
          supplyNotes: [''],
          risks: [''],
          strategyHints: [''],
        })
      }
    }
  }, [selectedMarketId, marketInfos])

  const handleSave = async () => {
    if (!season || !selectedMarketId) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await csrfFetch('/api/admin/market-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: season.id,
          marketId: selectedMarketId,
          ...formData,
          demandDrivers: formData.demandDrivers.filter((d) => d.trim()),
          supplyNotes: formData.supplyNotes.filter((s) => s.trim()),
          risks: formData.risks.filter((r) => r.trim()),
          strategyHints: formData.strategyHints.filter((h) => h.trim()),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.message || 'Failed to save')
        return
      }

      setSuccess('Saved successfully')
      fetchData()
      setTimeout(() => setSuccess(''), 3000)
    } catch {
      setError('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleAddLink = async () => {
    if (!newLink.label || !newLink.url) return
    const info = marketInfos.find((m) => m.marketId === selectedMarketId)
    if (!info) {
      setError('Save market info first before adding links')
      return
    }

    try {
      const res = await csrfFetch('/api/admin/market-info/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketInfoId: info.id, ...newLink }),
      })

      if (res.ok) {
        setNewLink({ label: '', url: '', type: 'OTHER', note: '' })
        setShowAddLink(false)
        fetchData()
      }
    } catch (err) {
      clientLogger.error('Failed to add link:', err)
      toast.error('Failed to add link')
    }
  }

  const handleDeleteLink = async (linkId: string) => {
    try {
      await csrfFetch(`/api/admin/market-info/links?id=${linkId}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      clientLogger.error('Failed to delete link:', err)
      toast.error('Failed to delete link')
    }
  }

  const handleAddRoundUpdate = async () => {
    if (!season || !selectedMarketId || !newRoundUpdate.headline || !newRoundUpdate.whatChanged) return

    try {
      const res = await csrfFetch('/api/admin/market-info/round-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: season.id,
          marketId: selectedMarketId,
          ...newRoundUpdate,
        }),
      })

      if (res.ok) {
        setNewRoundUpdate({ roundNumber: 1, headline: '', whatChanged: '' })
        setShowAddRoundUpdate(false)
        fetchData()
      }
    } catch (err) {
      clientLogger.error('Failed to add round update:', err)
      toast.error('Failed to add round update')
    }
  }

  const handleDeleteRoundUpdate = async (id: string) => {
    try {
      await csrfFetch(`/api/admin/market-info/round-updates?id=${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      clientLogger.error('Failed to delete round update:', err)
      toast.error('Failed to delete round update')
    }
  }

  const updateArrayField = (field: 'demandDrivers' | 'supplyNotes' | 'risks' | 'strategyHints', index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].map((item, i) => (i === index ? value : item)),
    }))
  }

  const addArrayItem = (field: 'demandDrivers' | 'supplyNotes' | 'risks' | 'strategyHints') => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...prev[field], ''],
    }))
  }

  const removeArrayItem = (field: 'demandDrivers' | 'supplyNotes' | 'risks' | 'strategyHints', index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  const selectedMarket = markets.find((m) => m.id === selectedMarketId)
  const selectedInfo = marketInfos.find((m) => m.marketId === selectedMarketId)
  const selectedLinks = selectedInfo?.resourceLinks || []
  const selectedRoundUpdates = roundUpdates.filter((u) => u.marketId === selectedMarketId)

  if (loading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="mb-6 space-y-2">
          <div className="h-7 bg-muted rounded w-48" />
          <div className="h-4 bg-surface-secondary rounded w-72" />
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="h-4 bg-muted rounded w-20" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-surface-secondary rounded w-full" />
              ))}
            </div>
          </div>
          <div className="col-span-9 space-y-6">
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-6 bg-muted rounded w-40" />
                  <div className="h-4 bg-surface-secondary rounded w-56" />
                </div>
                <div className="h-9 bg-muted rounded w-28" />
              </div>
              <div className="space-y-3">
                <div className="h-10 bg-surface-secondary rounded w-full" />
                <div className="h-10 bg-surface-secondary rounded w-full" />
                <div className="h-24 bg-surface-secondary rounded w-full" />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 bg-muted rounded w-28" />
                    <div className="h-10 bg-surface-secondary rounded w-full" />
                    <div className="h-10 bg-surface-secondary rounded w-full" />
                  </div>
                ))}
              </div>
            </div>
            <div className="border rounded-lg p-6 space-y-3">
              <div className="h-5 bg-muted rounded w-32" />
              <div className="h-4 bg-surface-secondary rounded w-48" />
              <div className="h-12 bg-surface-secondary rounded w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!season) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-warning" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">No operational season is available.</p>
                <p className="text-sm text-text-secondary">
                  Create, activate, or resume a season before managing market information.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/admin/season">Go to Season Management</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Market Information</h1>
        <p className="text-text-secondary">Manage market context and resources for {season.name}</p>
      </div>

      {error && (
        <AlertBanner variant="error" className="mb-4">{error}</AlertBanner>
      )}
      {success && (
        <AlertBanner variant="success" className="mb-4">{success}</AlertBanner>
      )}

      {markets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground">No markets are linked to this season yet.</p>
              <p className="text-sm text-text-secondary">
                Add season markets in Season Management, then return here to manage market notes and updates.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin/season">Manage Season Markets</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Markets</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {markets.map((market) => {
                    const hasInfo = marketInfos.some((m) => m.marketId === market.id)
                    return (
                      <button
                        key={market.id}
                        onClick={() => setSelectedMarketId(market.id)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm hover:bg-surface-secondary ${
                          selectedMarketId === market.id ? 'bg-info-background text-info' : ''
                        }`}
                      >
                        <span>{market.name}</span>
                        <span className="flex items-center gap-2">
                          {hasInfo && <span className="w-2 h-2 bg-success-background0 rounded-full" />}
                          <ChevronRight className="h-4 w-4 text-text-muted" />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="col-span-9 space-y-6">
            {selectedMarket && (
              <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{selectedMarket.name}</CardTitle>
                    <CardDescription>Edit market overview and key insights</CardDescription>
                  </div>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Greater Boston Market Overview"
                      />
                    </div>
                    <div>
                      <Label htmlFor="summary">Summary (Brief)</Label>
                      <Input
                        id="summary"
                        value={formData.summary}
                        onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                        placeholder="One-line summary of the market"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        className="min-h-[100px]"
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Detailed description of the market..."
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Demand Drivers</Label>
                        <Button variant="ghost" size="sm" onClick={() => addArrayItem('demandDrivers')}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.demandDrivers.map((item, i) => (
                          <div key={i} className="flex gap-2">
                            <div className="flex items-center text-text-muted">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Input
                              value={item}
                              onChange={(e) => updateArrayField('demandDrivers', i, e.target.value)}
                              placeholder="e.g., Business conferences"
                            />
                            {formData.demandDrivers.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeArrayItem('demandDrivers', i)}>
                                <Trash2 className="h-4 w-4 text-text-muted" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Supply Notes</Label>
                        <Button variant="ghost" size="sm" onClick={() => addArrayItem('supplyNotes')}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.supplyNotes.map((item, i) => (
                          <div key={i} className="flex gap-2">
                            <div className="flex items-center text-text-muted">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Input
                              value={item}
                              onChange={(e) => updateArrayField('supplyNotes', i, e.target.value)}
                              placeholder="e.g., New hotel opening in Q2"
                            />
                            {formData.supplyNotes.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeArrayItem('supplyNotes', i)}>
                                <Trash2 className="h-4 w-4 text-text-muted" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Risks</Label>
                        <Button variant="ghost" size="sm" onClick={() => addArrayItem('risks')}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.risks.map((item, i) => (
                          <div key={i} className="flex gap-2">
                            <div className="flex items-center text-text-muted">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Input
                              value={item}
                              onChange={(e) => updateArrayField('risks', i, e.target.value)}
                              placeholder="e.g., Weather event uncertainty"
                            />
                            {formData.risks.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeArrayItem('risks', i)}>
                                <Trash2 className="h-4 w-4 text-text-muted" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Strategy Hints</Label>
                        <Button variant="ghost" size="sm" onClick={() => addArrayItem('strategyHints')}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {formData.strategyHints.map((item, i) => (
                          <div key={i} className="flex gap-2">
                            <div className="flex items-center text-text-muted">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <Input
                              value={item}
                              onChange={(e) => updateArrayField('strategyHints', i, e.target.value)}
                              placeholder="e.g., Monitor competitor pricing"
                            />
                            {formData.strategyHints.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeArrayItem('strategyHints', i)}>
                                <Trash2 className="h-4 w-4 text-text-muted" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Resource Links</CardTitle>
                    <CardDescription>External resources for students</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowAddLink(!showAddLink)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Link
                  </Button>
                </CardHeader>
                <CardContent>
                  {showAddLink && (
                    <div className="mb-4 p-4 bg-surface-secondary rounded-lg space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          placeholder="Label (e.g., STR Report)"
                          value={newLink.label}
                          onChange={(e) => setNewLink((prev) => ({ ...prev, label: e.target.value }))}
                        />
                        <Input
                          placeholder="URL"
                          value={newLink.url}
                          onChange={(e) => setNewLink((prev) => ({ ...prev, url: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={newLink.type} onValueChange={(val) => setNewLink((prev) => ({ ...prev, type: val }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DATA">Data Source</SelectItem>
                            <SelectItem value="DOCUMENT">Document</SelectItem>
                            <SelectItem value="TUTORIAL">Tutorial</SelectItem>
                            <SelectItem value="OTHER">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Note (optional)"
                          value={newLink.note}
                          onChange={(e) => setNewLink((prev) => ({ ...prev, note: e.target.value }))}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowAddLink(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleAddLink}>
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedLinks.length === 0 ? (
                    <p className="text-text-muted text-sm">No resource links added yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedLinks.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 bg-surface-secondary rounded-lg">
                          <div className="flex items-center gap-3">
                            <ExternalLink className="h-4 w-4 text-text-muted" />
                            <div>
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">
                                {link.label}
                              </a>
                              <div className="flex items-center gap-2 text-xs text-text-muted">
                                <span className="px-1.5 py-0.5 bg-muted rounded">{link.type}</span>
                                {link.note && <span>{link.note}</span>}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteLink(link.id)}>
                            <Trash2 className="h-4 w-4 text-text-muted" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Round Updates</CardTitle>
                    <CardDescription>What changed this round notifications</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowAddRoundUpdate(!showAddRoundUpdate)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Update
                  </Button>
                </CardHeader>
                <CardContent>
                  {showAddRoundUpdate && (
                    <div className="mb-4 p-4 bg-surface-secondary rounded-lg space-y-3">
                      <div className="grid grid-cols-4 gap-3">
                        <Input
                          type="number"
                          min="1"
                          max="8"
                          placeholder="Round #"
                          value={newRoundUpdate.roundNumber}
                          onChange={(e) => setNewRoundUpdate((prev) => ({ ...prev, roundNumber: parseInt(e.target.value) || 1 }))}
                        />
                        <div className="col-span-3">
                          <Input
                            placeholder="Headline"
                            value={newRoundUpdate.headline}
                            onChange={(e) => setNewRoundUpdate((prev) => ({ ...prev, headline: e.target.value }))}
                          />
                        </div>
                      </div>
                      <Textarea
                        placeholder="What changed this round..."
                        value={newRoundUpdate.whatChanged}
                        onChange={(e) => setNewRoundUpdate((prev) => ({ ...prev, whatChanged: e.target.value }))}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setShowAddRoundUpdate(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleAddRoundUpdate}>
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedRoundUpdates.length === 0 ? (
                    <p className="text-text-muted text-sm">No round updates added yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedRoundUpdates.map((update) => (
                        <div key={update.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-info-background text-info text-xs font-medium rounded">
                                  Round {update.roundNumber}
                                </span>
                                <span className="font-medium">{update.headline}</span>
                              </div>
                              <p className="text-sm text-text-secondary">{update.whatChanged}</p>
                              {update.createdBy && (
                                <p className="text-xs text-text-muted mt-2">
                                  By {update.createdBy.firstName} {update.createdBy.lastName}
                                </p>
                              )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteRoundUpdate(update.id)}>
                              <Trash2 className="h-4 w-4 text-text-muted" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


