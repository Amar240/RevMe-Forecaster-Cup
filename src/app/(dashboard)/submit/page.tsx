'use client'

import { clientLogger } from '@/lib/client-logger'
import { getCurrentSubmission, submitForecast } from '@/features/submissions/api'
import type { ExistingSubmission, LockReason, MarketInfo, RoundInfo } from '@/features/submissions/types'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Clock, Lock, Check, AlertTriangle, ChevronRight, MapPin, DollarSign, Send, Pause, Ban } from 'lucide-react'
import { AlertBanner } from '@/components/ui/alert-banner'
import { toast } from 'sonner'

const LOCK_MESSAGES: Record<string, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  SEASON_NOT_ACTIVE: {
    title: 'Competition Not Active',
    description: 'The competition is currently paused or not started. Submissions will resume when the admin activates it.',
    icon: Pause,
  },
  ROUND_NOT_OPEN: {
    title: 'Round Not Open Yet',
    description: 'This round has not opened for submissions yet. Please wait for the admin to open it.',
    icon: Clock,
  },
  ROUND_PAUSED: {
    title: 'Round Paused',
    description: 'This round is temporarily paused. Submissions will resume when the admin resumes the round.',
    icon: Pause,
  },
  ROUND_CLOSED: {
    title: 'Round Closed',
    description: 'This round has been closed. Submissions are no longer accepted.',
    icon: Ban,
  },
  DEADLINE_PASSED: {
    title: 'Deadline Passed',
    description: 'The submission deadline for this round has passed.',
    icon: Clock,
  },
  INVALID_MARKETS: {
    title: 'Markets Not Configured',
    description: 'This season must have exactly 3 active markets. Please contact your admin.',
    icon: AlertTriangle,
  },
  NO_ACTIVE_ROUND: {
    title: 'No Active Round',
    description: 'There is no round currently open for submissions.',
    icon: Clock,
  },
}

export default function SubmitPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [currentRound, setCurrentRound] = useState<RoundInfo | null>(null)
  const [markets, setMarkets] = useState<MarketInfo[]>([])
  const [existingSubmissions, setExistingSubmissions] = useState<ExistingSubmission[]>([])
  const [canSubmit, setCanSubmit] = useState(false)
  const [lockReason, setLockReason] = useState<LockReason>(null)
  const [seasonStatus, setSeasonStatus] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<Record<string, { occupancy: string; adr: string }>>({})
  const [activeMarket, setActiveMarket] = useState<string>('')
  const [showReview, setShowReview] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!currentRound) return

    const updateTime = () => {
      const deadline = new Date(currentRound.closesAt)
      const now = new Date()
      const diff = deadline.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining('Closed')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`)
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`)
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [currentRound])

  const fetchData = async () => {
    try {
      const data = await getCurrentSubmission()
      if (!data) {
        setLoading(false)
        return
      }

      setCurrentRound(data.currentRound)
      setMarkets(data.markets || [])
      setExistingSubmissions(data.existingSubmissions || [])
      setCanSubmit(data.canSubmit)
      setLockReason(data.lockReason)
      setSeasonStatus(data.seasonStatus)
      if (data.markets?.length > 0) {
        setActiveMarket(data.markets[0].id)
      }

      const initialPredictions: Record<string, { occupancy: string; adr: string }> = {}
      data.markets?.forEach((market: MarketInfo) => {
        const weeks = data.currentRound?.isFinal ? [1] : [1, 2]
        weeks.forEach((week) => {
          const key = `${market.id}-${week}`
          const existing = data.existingSubmissions?.find(
            (s: ExistingSubmission) => s.marketId === market.id && s.weekOffset === week
          )
          initialPredictions[key] = {
            occupancy: existing?.occupancy?.toString() || '',
            adr: existing?.adr?.toString() || '',
          }
        })
      })
      setPredictions(initialPredictions)
    } catch (err) {
      clientLogger.error('Failed to fetch data:', err)
      toast.error('Failed to load submission data')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)

    try {
      const submissions = Object.entries(predictions).map(([key, value]) => {
        const [marketId, weekOffset] = key.split('-')
        return {
          marketId,
          weekOffset: parseInt(weekOffset),
          occupancy: parseFloat(value.occupancy),
          adr: parseFloat(value.adr),
        }
      })

      await submitForecast({ roundId: currentRound?.id || null, submissions })

      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setShowReview(false)
    } finally {
      setSubmitting(false)
    }
  }

  const isFormComplete = () => {
    return Object.values(predictions).every(
      (p) => p.occupancy !== '' && p.adr !== '' && 
             parseFloat(p.occupancy) >= 0 && parseFloat(p.occupancy) <= 100 &&
             parseFloat(p.adr) >= 0
    )
  }

  const getFilledCount = () => {
    return Object.values(predictions).filter(
      (p) => p.occupancy !== '' && p.adr !== ''
    ).length * 2
  }

  const getTotalRequired = () => {
    const weeks = currentRound?.isFinal ? 1 : 2
    return markets.length * weeks * 2
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /><p className="text-sm text-muted-foreground">Loading submissions…</p></div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center text-white">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Submission Successful!</h2>
            <p className="text-green-100">Your forecast has been locked and cannot be edited.</p>
          </div>
          <CardContent className="p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentRound && lockReason === 'INVALID_MARKETS') {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Markets Not Configured</h2>
            <p className="text-gray-500 dark:text-gray-400">This season needs exactly three active markets before submissions open.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentRound || lockReason === 'NO_ACTIVE_ROUND') {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Active Round</h2>
            <p className="text-gray-500 dark:text-gray-400">There is no round open for submissions right now.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isLocked = lockReason && lockReason !== null
  const hasExisting = existingSubmissions.length > 0
  const lockInfo = lockReason ? LOCK_MESSAGES[lockReason] : null

  if (isLocked && !hasExisting && lockInfo) {
    const LockIcon = lockInfo.icon
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Round {currentRound.number} Submission
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Deadline: {new Date(currentRound.closesAt).toLocaleString('en-US', { 
              timeZone: 'America/New_York',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })} ET
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <LockIcon className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-amber-900 mb-2">{lockInfo.title}</h2>
            <p className="text-amber-700">{lockInfo.description}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview: Your Predictions</CardTitle>
            <CardDescription>
              Once the round opens, you will be able to enter your forecasts below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {markets.map((market) => (
                <div key={market.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-2 mb-3">
                    <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{market.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(currentRound.isFinal ? [1] : [1, 2]).map((week) => (
                      <div key={week} className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Week +{week}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 dark:text-gray-500">Occupancy</span>
                            <span className="text-gray-300 dark:text-gray-400">---</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400 dark:text-gray-500">ADR</span>
                            <span className="text-gray-300 dark:text-gray-400">$---</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!canSubmit && !hasExisting) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Cannot Submit</h2>
            <p className="text-gray-500 dark:text-gray-400">
              You are either not the team submitter, not on a team, or your team is not approved yet.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showReview && !hasExisting) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setShowReview(false)} className="mb-4">
            <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
            Back to Edit
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Review Your Submission</h1>
          <p className="text-gray-500 dark:text-gray-400">Please review your predictions before submitting.</p>
        </div>

        {error && (
          <AlertBanner variant="error">{error}</AlertBanner>
        )}

        <div className="grid gap-6">
          {markets.map((market) => (
            <Card key={market.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <span>{market.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {(currentRound.isFinal ? [1] : [1, 2]).map((week) => {
                    const key = `${market.id}-${week}`
                    return (
                      <div key={week} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Week +{week}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Occupancy</p>
                            <p className="text-lg font-semibold text-blue-600">{predictions[key]?.occupancy}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">ADR</p>
                            <p className="text-lg font-semibold text-emerald-600">${predictions[key]?.adr}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30">
          <CardContent className="py-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">Warning: This action cannot be undone</p>
                <p className="text-sm text-amber-700">Once submitted, your forecast is LOCKED and cannot be edited.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex space-x-4">
          <Button variant="outline" onClick={() => setShowReview(false)} className="flex-1">
            Go Back & Edit
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting} 
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? (
              'Submitting...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Confirm & Submit
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
      <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Round {currentRound.number} Submission
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Deadline: {new Date(currentRound.closesAt).toLocaleString('en-US', {
              timeZone: 'America/New_York',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })} ET
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full">
            {timeRemaining}
          </span>
        </div>
      </div>

      {hasExisting && (
        <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:border-green-800 dark:from-green-900/30 dark:to-emerald-900/30">
          <CardContent className="py-4 flex items-center space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Lock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-green-700">Submission Locked</p>
              <p className="text-sm text-green-600">Your forecast has been submitted and cannot be edited.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <AlertBanner variant="error">{error}</AlertBanner>
      )}

      {!hasExisting && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Progress:</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{getFilledCount()} / {getTotalRequired()}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">values entered</span>
              </div>
              <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(getFilledCount() / getTotalRequired()) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex space-x-2 border-b dark:border-gray-700">
        {markets.map((market) => (
          <button
            key={market.id}
            onClick={() => setActiveMarket(market.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeMarket === market.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>{market.name}</span>
            </div>
          </button>
        ))}
      </div>

      {markets.filter((m) => m.id === activeMarket).map((market) => (
        <Card key={market.id}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <span>{market.name}</span>
            </CardTitle>
            <CardDescription>
              Enter your predictions for occupancy and ADR ($)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {(currentRound.isFinal ? [1] : [1, 2]).map((week) => {
                const key = `${market.id}-${week}`
                return (
                  <div key={week} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
                      <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        +{week}
                      </span>
                      <span>Week +{week}</span>
                    </h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-occupancy`} className="flex items-center space-x-2">
                          <span>Occupancy</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id={`${key}-occupancy`}
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="e.g., 72.5"
                            value={predictions[key]?.occupancy || ''}
                            onChange={(e) =>
                              setPredictions({
                                ...predictions,
                                [key]: { ...predictions[key], occupancy: e.target.value },
                              })
                            }
                            disabled={hasExisting}
                            className="pr-3"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-adr`} className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-emerald-600" />
                          <span>ADR ($)</span>
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">$</span>
                          <Input
                            id={`${key}-adr`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="e.g., 145.00"
                            value={predictions[key]?.adr || ''}
                            onChange={(e) =>
                              setPredictions({
                                ...predictions,
                                [key]: { ...predictions[key], adr: e.target.value },
                              })
                            }
                            disabled={hasExisting}
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {!hasExisting && (
        <div className="flex justify-end">
          <Button 
            size="lg" 
            onClick={() => setShowReview(true)}
            disabled={!isFormComplete()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Review Submission
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}

