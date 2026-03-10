'use client'

import { clientLogger } from '@/lib/client-logger'
import { createSeason, getSeasonOverview, updateRoundStatus, updateSeasonStatus } from '@/features/season/api'
import type { SeasonSummary } from '@/features/season/types'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Play, Pause, Square, RotateCcw, Clock, Edit2, Check, X, AlertTriangle } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { PageLoader } from '@/components/ui/page-loader'
import { csrfFetch } from '@/lib/csrf'
import { toast } from 'sonner'

interface MarketOption {
  id: string
  name: string
}

const DEFAULT_MARKET_NAMES = ['Nashville CBD', 'Dubai', 'Hamburg']

export default function AdminSeasonPage() {
  const [season, setSeason] = useState<SeasonSummary | null>(null)
  const [completedSeasons, setCompletedSeasons] = useState<SeasonSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingRound, setEditingRound] = useState<string | null>(null)
  const [editDates, setEditDates] = useState({ opensAt: '', closesAt: '' })
  const [availableMarkets, setAvailableMarkets] = useState<MarketOption[]>([])
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    totalRounds: 7,
    daysPerRound: 7,
    marketIds: [] as string[],
  })

  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmCloseRound, setConfirmCloseRound] = useState<string | null>(null)

  const computeEndDate = useCallback((startDate: string, totalRounds: number, daysPerRound: number) => {
    if (!startDate) return ''
    const [year, month, day] = startDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + totalRounds * daysPerRound - 1)
    return date.toISOString().slice(0, 10)
  }, [])

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/markets')
      if (res.ok) {
        const data = await res.json()
        const markets: MarketOption[] = data.markets ?? []
        setAvailableMarkets(markets)
        const defaultIds = markets
          .filter((m) => DEFAULT_MARKET_NAMES.includes(m.name))
          .map((m) => m.id)
        setFormData((prev) => ({ ...prev, marketIds: defaultIds }))
      }
    } catch {
      clientLogger.error('Failed to fetch markets')
    }
  }, [])

  useEffect(() => {
    fetchSeason()
    fetchMarkets()
  }, [fetchMarkets])

  const fetchSeason = async () => {
    try {
      const data = await getSeasonOverview()
      setSeason(data.season)
      setCompletedSeasons(data.completedSeasons || [])
    } catch (err) {
      clientLogger.error('Failed to fetch season:', err)
      toast.error('Failed to load season data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      await createSeason({
        name: formData.name,
        startDate: formData.startDate,
        endDate: formData.endDate,
        totalRounds: formData.totalRounds,
        daysPerRound: formData.daysPerRound,
        marketIds: formData.marketIds.length > 0 ? formData.marketIds : undefined,
      })
      fetchSeason()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setCreating(false)
    }
  }

  const handleSeasonAction = async (action: 'start' | 'pause' | 'resume' | 'complete') => {
    setActionLoading(action)
    setError('')
    setSuccess('')

    try {
      const data = await updateSeasonStatus(action, season?.id)
      setSuccess(data.message)
      fetchSeason()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRoundStatusChange = async (roundId: string, newStatus: 'UPCOMING' | 'OPEN' | 'PAUSED' | 'CLOSED', dates?: { opensAt?: string; closesAt?: string }) => {
    setActionLoading(roundId)
    setError('')
    setSuccess('')

    try {
      const data = await updateRoundStatus({
        roundId,
        status: newStatus,
        opensAt: dates?.opensAt,
        closesAt: dates?.closesAt,
      })
      setSuccess(data.message)
      setEditingRound(null)
      fetchSeason()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  const startEditingRound = (round: SeasonSummary['rounds'][0]) => {
    setEditingRound(round.id)
    setEditDates({
      opensAt: new Date(round.opensAt).toISOString().slice(0, 16),
      closesAt: new Date(round.closesAt).toISOString().slice(0, 16),
    })
  }

  const saveRoundDates = async (roundId: string, currentStatus: string) => {
    await handleRoundStatusChange(roundId, currentStatus as 'UPCOMING' | 'OPEN' | 'PAUSED' | 'CLOSED', editDates)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-700'
      case 'ACTIVE': return 'bg-green-100 text-green-700'
      case 'PAUSED': return 'bg-amber-100 text-amber-700'
      case 'COMPLETED': return 'bg-blue-100 text-blue-700'
      case 'UPCOMING': return 'bg-gray-100 text-gray-700'
      case 'OPEN': return 'bg-green-100 text-green-700'
      case 'CLOSED': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return <PageLoader message="Loading season data…" />
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Season Management</h1>
        <p className="text-gray-600">Configure competition seasons and rounds</p>
      </div>

      {error && (
        <AlertBanner variant="error" dismissible className="[&_button]:!p-1" icon={<AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />}>
          {error}
        </AlertBanner>
      )}

      {success && (
        <AlertBanner variant="success" dismissible>
          {success}
        </AlertBanner>
      )}

      {season ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-3">
                    <span>{season.name}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(season.status)}`}>
                      {season.status}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Registration: {season.registrationOpen ? 'Open' : 'Closed'}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  {season.status === 'DRAFT' && (
                    <Button 
                      onClick={() => handleSeasonAction('start')}
                      disabled={actionLoading === 'start'}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {actionLoading === 'start' ? 'Starting...' : 'Start Season'}
                    </Button>
                  )}
                  {season.status === 'ACTIVE' && (
                    <>
                      <Button 
                        variant="outline"
                        onClick={() => handleSeasonAction('pause')}
                        disabled={actionLoading === 'pause'}
                        className="border-amber-500 text-amber-600 hover:bg-amber-50"
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        {actionLoading === 'pause' ? 'Pausing...' : 'Pause'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setConfirmComplete(true)}
                        disabled={actionLoading === 'complete'}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        {actionLoading === 'complete' ? 'Completing...' : 'Complete'}
                      </Button>
                    </>
                  )}
                  {season.status === 'PAUSED' && (
                    <>
                      <Button 
                        onClick={() => handleSeasonAction('resume')}
                        disabled={actionLoading === 'resume'}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        {actionLoading === 'resume' ? 'Resuming...' : 'Resume'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setConfirmComplete(true)}
                        disabled={actionLoading === 'complete'}
                      >
                        <Square className="h-4 w-4 mr-2" />
                        {actionLoading === 'complete' ? 'Completing...' : 'Complete'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium">
                    {new Date(season.startDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">End Date</p>
                  <p className="font-medium">
                    {new Date(season.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {season.status === 'PAUSED' && (
                <AlertBanner variant="warning" title="Season Paused" icon={<Pause className="h-5 w-5 flex-shrink-0 mt-0.5" />}>
                  All submissions are blocked while the season is paused.
                </AlertBanner>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Markets</CardTitle>
              <CardDescription>Active markets for this season</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {season.markets.map((sm) => (
                  <span
                    key={sm.id}
                    className={`px-3 py-1 rounded-full text-sm ${
                      sm.isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {sm.market.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rounds</CardTitle>
              <CardDescription>
                {season.rounds.length} rounds with deadlines. Only 1 round can be OPEN at a time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {season.rounds.map((round) => {
                  const isEditing = editingRound === round.id
                  const isLoading = actionLoading === round.id

                  return (
                    <div
                      key={round.id}
                      className="p-4 border rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <p className="font-medium">
                              Round {round.number}
                            </p>
                            {round.isFinal && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                                Final
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(round.status)}`}>
                              {round.status}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Opens At</Label>
                                <Input
                                  type="datetime-local"
                                  value={editDates.opensAt}
                                  onChange={(e) => setEditDates({ ...editDates, opensAt: e.target.value })}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Closes At</Label>
                                <Input
                                  type="datetime-local"
                                  value={editDates.closesAt}
                                  onChange={(e) => setEditDates({ ...editDates, closesAt: e.target.value })}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {new Date(round.opensAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} 
                              {' - '}
                              {new Date(round.closesAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 ml-4">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => setEditingRound(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                className="h-8"
                                disabled={isLoading}
                                onClick={() => saveRoundDates(round.id, round.status)}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={() => startEditingRound(round)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>

                              {round.status === 'UPCOMING' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-green-600 border-green-300 hover:bg-green-50"
                                  disabled={isLoading}
                                  onClick={() => handleRoundStatusChange(round.id, 'OPEN')}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Open
                                </Button>
                              )}

                              {round.status === 'OPEN' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-amber-600 border-amber-300 hover:bg-amber-50"
                                    disabled={isLoading}
                                    onClick={() => handleRoundStatusChange(round.id, 'PAUSED')}
                                  >
                                    <Pause className="h-3 w-3 mr-1" />
                                    Pause
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-red-600 border-red-300 hover:bg-red-50"
                                    disabled={isLoading}
                                    onClick={() => setConfirmCloseRound(round.id)}
                                  >
                                    <Square className="h-3 w-3 mr-1" />
                                    Close
                                  </Button>
                                </>
                              )}

                              {round.status === 'PAUSED' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-green-600 border-green-300 hover:bg-green-50"
                                    disabled={isLoading}
                                    onClick={() => handleRoundStatusChange(round.id, 'OPEN')}
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Resume
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-red-600 border-red-300 hover:bg-red-50"
                                    disabled={isLoading}
                                    onClick={() => setConfirmCloseRound(round.id)}
                                  >
                                    <Square className="h-3 w-3 mr-1" />
                                    Close
                                  </Button>
                                </>
                              )}

                              {round.status === 'CLOSED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-green-600 border-green-300 hover:bg-green-50"
                                  disabled={isLoading}
                                  onClick={() => handleRoundStatusChange(round.id, 'OPEN')}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reopen
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create New Season</CardTitle>
            <CardDescription>
              Set up a new competition season with rounds and markets
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleCreate}>
            <CardContent className="space-y-4">
              {error && (
                <AlertBanner variant="error">
                  {error}
                </AlertBanner>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Season Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Fall 2025"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalRounds">Total Rounds</Label>
                  <Input
                    id="totalRounds"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.totalRounds}
                    onChange={(e) => {
                      const totalRounds = Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
                      setFormData((prev) => ({
                        ...prev,
                        totalRounds,
                        endDate: computeEndDate(prev.startDate, totalRounds, prev.daysPerRound),
                      }))
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daysPerRound">Days Per Round</Label>
                  <Input
                    id="daysPerRound"
                    type="number"
                    min={1}
                    max={30}
                    value={formData.daysPerRound}
                    onChange={(e) => {
                      const daysPerRound = Math.max(1, Math.min(30, parseInt(e.target.value) || 1))
                      setFormData((prev) => ({
                        ...prev,
                        daysPerRound,
                        endDate: computeEndDate(prev.startDate, prev.totalRounds, daysPerRound),
                      }))
                    }}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => {
                      const value = e.target.value
                      setFormData((prev) => ({
                        ...prev,
                        startDate: value,
                        endDate: computeEndDate(value, prev.totalRounds, prev.daysPerRound),
                      }))
                    }}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    readOnly
                    aria-readonly="true"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Auto-calculated: {formData.totalRounds} rounds × {formData.daysPerRound} days = {formData.totalRounds * formData.daysPerRound} days total.
                  </p>
                </div>
              </div>

              {availableMarkets.length > 0 && (
                <div className="space-y-3">
                  <Label>Markets</Label>
                  <p className="text-xs text-gray-500">Select which markets to include in this season. Defaults to Nashville CBD, Dubai, and Hamburg.</p>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {availableMarkets.map((market) => (
                      <label
                        key={market.id}
                        className="flex items-center space-x-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <Checkbox
                          checked={formData.marketIds.includes(market.id)}
                          onCheckedChange={(checked) => {
                            setFormData((prev) => ({
                              ...prev,
                              marketIds: checked
                                ? [...prev.marketIds, market.id]
                                : prev.marketIds.filter((id) => id !== market.id),
                            }))
                          }}
                        />
                        <span className="text-sm">{market.name}</span>
                      </label>
                    ))}
                  </div>
                  {formData.marketIds.length === 0 && (
                    <p className="text-xs text-amber-600">No markets selected — the default 3 markets will be used.</p>
                  )}
                </div>
              )}

              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Season'}
              </Button>
            </CardContent>
          </form>
        </Card>
      )}

      {completedSeasons.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Season History</CardTitle>
            <CardDescription>Previously completed seasons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedSeasons.map((s) => (
                <div
                  key={s.id}
                  className="p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-gray-900">{s.name}</p>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                          COMPLETED
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {s._count?.teams || 0} teams
                      </p>
                      <p className="text-sm text-gray-500">
                        {s.rounds.length} rounds
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title="Complete Season"
        description="This will end the competition. Are you sure?"
        confirmLabel="Complete Season"
        variant="destructive"
        loading={actionLoading === 'complete'}
        onConfirm={async () => {
          await handleSeasonAction('complete')
          setConfirmComplete(false)
        }}
      />

      <ConfirmDialog
        open={confirmCloseRound !== null}
        onOpenChange={(open) => { if (!open) setConfirmCloseRound(null) }}
        title="Close Round"
        description="Closing this round will prevent further submissions. Continue?"
        confirmLabel="Close Round"
        variant="destructive"
        loading={confirmCloseRound !== null && actionLoading === confirmCloseRound}
        onConfirm={async () => {
          if (confirmCloseRound) {
            await handleRoundStatusChange(confirmCloseRound, 'CLOSED')
            setConfirmCloseRound(null)
          }
        }}
      />
    </div>
  )
}

