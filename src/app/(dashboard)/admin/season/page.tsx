'use client'

import { clientLogger } from '@/lib/client-logger'
import { createSeason, getSeasonOverview, updateRoundStatus, updateSeasonStatus } from '@/features/season/api'
import type { SeasonSummary } from '@/features/season/types'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Play, Pause, Square, RotateCcw, Clock, Edit2, Check, X, AlertTriangle } from 'lucide-react'

export default function AdminSeasonPage() {
  const totalRounds = 7
  const daysPerRound = 7
  const totalSeasonDays = totalRounds * daysPerRound
  const [season, setSeason] = useState<SeasonSummary | null>(null)
  const [completedSeasons, setCompletedSeasons] = useState<SeasonSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingRound, setEditingRound] = useState<string | null>(null)
  const [editDates, setEditDates] = useState({ opensAt: '', closesAt: '' })
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
  })

  const computeEndDate = (startDate: string) => {
    if (!startDate) return ''
    const [year, month, day] = startDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setDate(date.getDate() + totalSeasonDays - 1)
    return date.toISOString().slice(0, 10)
  }

  useEffect(() => {
    fetchSeason()
  }, [])

  const fetchSeason = async () => {
    try {
      const data = await getSeasonOverview()
      setSeason(data.season)
      setCompletedSeasons(data.completedSeasons || [])
    } catch (err) {
      clientLogger.error('Failed to fetch season:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)

    try {
      await createSeason(formData)
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
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Season Management</h1>
        <p className="text-gray-600">Configure competition seasons and rounds</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <Check className="h-5 w-5" />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-500 hover:text-green-700">×</button>
        </div>
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
                        onClick={() => handleSeasonAction('complete')}
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
                        onClick={() => handleSeasonAction('complete')}
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
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
                  <Pause className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Season Paused</p>
                    <p className="text-sm text-amber-700">All submissions are blocked while the season is paused.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Markets</CardTitle>
              <CardDescription>Active markets for this season (exactly 3 required)</CardDescription>
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
                                    onClick={() => handleRoundStatusChange(round.id, 'CLOSED')}
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
                                    onClick={() => handleRoundStatusChange(round.id, 'CLOSED')}
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
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-md text-sm">
                  {error}
                </div>
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
                        endDate: computeEndDate(value),
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
                  <p className="text-xs text-gray-500">Calculated as 7 weekly rounds from the start date.</p>
                </div>
              </div>
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
    </div>
  )
}

