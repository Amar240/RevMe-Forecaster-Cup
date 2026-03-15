'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { clientLogger } from '@/lib/client-logger'
import { getCurrentSubmission, submitForecast } from '@/features/submissions/api'
import type { ExistingSubmission, LockReason, MarketInfo, RoundInfo } from '@/features/submissions/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertBanner } from '@/components/ui/alert-banner'
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronRight,
  Clock,
  DollarSign,
  Lock,
  MapPin,
  Pause,
  Send,
} from 'lucide-react'

const LOCK_MESSAGES: Record<
  string,
  { title: string; description: string; icon: ComponentType<{ className?: string }> }
> = {
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

function formatDeadline(date: string) {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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
  const [predictions, setPredictions] = useState<Record<string, { occupancy: string; adr: string }>>({})
  const [activeMarket, setActiveMarket] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')

  useEffect(() => {
    void fetchData()
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

      if (data.markets?.length > 0) {
        setActiveMarket(data.markets[0].id)
      }

      const initialPredictions: Record<string, { occupancy: string; adr: string }> = {}
      data.markets?.forEach((market: MarketInfo) => {
        const weeks = data.currentRound?.isFinal ? [1] : [1, 2]
        weeks.forEach((week) => {
          const key = `${market.id}-${week}`
          const existing = data.existingSubmissions?.find(
            (submission: ExistingSubmission) => submission.marketId === market.id && submission.weekOffset === week
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
          weekOffset: parseInt(weekOffset, 10),
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

  const isFormComplete = () =>
    Object.values(predictions).every(
      (prediction) =>
        prediction.occupancy !== '' &&
        prediction.adr !== '' &&
        parseFloat(prediction.occupancy) >= 0 &&
        parseFloat(prediction.occupancy) <= 100 &&
        parseFloat(prediction.adr) >= 0
    )

  const getFilledCount = () =>
    Object.values(predictions).filter((prediction) => prediction.occupancy !== '' && prediction.adr !== '').length * 2

  const getTotalRequired = () => {
    const weeks = currentRound?.isFinal ? 1 : 2
    return markets.length * weeks * 2
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-success to-info p-8 text-center text-primary-foreground">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
              <Check className="h-10 w-10" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Submission Successful!</h2>
            <p className="text-primary-foreground/80">Your forecast has been locked and cannot be edited.</p>
          </div>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentRound && lockReason === 'INVALID_MARKETS') {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-background">
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">Markets Not Configured</h2>
            <p className="text-muted-foreground">This season needs exactly three active markets before submissions open.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!currentRound || lockReason === 'NO_ACTIVE_ROUND') {
    return (
      <div className="mx-auto mt-12 max-w-lg">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary">
              <Clock className="h-8 w-8 text-text-muted" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">No Active Round</h2>
            <p className="text-muted-foreground">There is no round open for submissions right now.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isLocked = lockReason !== null
  const hasExisting = existingSubmissions.length > 0
  const lockInfo = lockReason ? LOCK_MESSAGES[lockReason] : null

  if (isLocked && !hasExisting && lockInfo) {
    const LockIcon = lockInfo.icon

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Round {currentRound.number} Submission</h1>
          <p className="text-text-secondary">Deadline: {formatDeadline(currentRound.closesAt)} ET</p>
        </div>

        <Card className="border-warning/20 bg-warning-background">
          <CardContent className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card">
              <LockIcon className="h-8 w-8 text-warning" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">{lockInfo.title}</h2>
            <p className="text-text-secondary">{lockInfo.description}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview: Your Predictions</CardTitle>
            <CardDescription>Once the round opens, you will be able to enter your forecasts below.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {markets.map((market) => (
                <div key={market.id} className="rounded-lg border border-border bg-surface-secondary p-4">
                  <div className="mb-3 flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">{market.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {(currentRound.isFinal ? [1] : [1, 2]).map((week) => (
                      <div key={week} className="rounded-lg border border-border bg-card p-3">
                        <p className="mb-2 text-sm text-muted-foreground">Week +{week}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted">Occupancy</span>
                            <span className="text-text-muted">---</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-text-muted">ADR</span>
                            <span className="text-text-muted">$---</span>
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
      <div className="mx-auto mt-12 max-w-lg">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary">
              <Lock className="h-8 w-8 text-text-muted" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">Cannot Submit</h2>
            <p className="text-muted-foreground">
              You are either not the team submitter, not on a team, or your team is not approved yet.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (showReview && !hasExisting) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Button variant="ghost" onClick={() => setShowReview(false)} className="mb-4">
            <ChevronRight className="mr-1 h-4 w-4 rotate-180" />
            Back to Edit
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Review Your Submission</h1>
          <p className="text-text-secondary">Please review your predictions before submitting.</p>
        </div>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}

        <div className="grid gap-6">
          {markets.map((market) => (
            <Card key={market.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span>{market.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {(currentRound.isFinal ? [1] : [1, 2]).map((week) => {
                    const key = `${market.id}-${week}`
                    return (
                      <div key={week} className="rounded-lg border border-border bg-surface-secondary p-4">
                        <h4 className="mb-3 font-medium text-foreground">Week +{week}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Occupancy</p>
                            <p className="text-lg font-semibold text-primary">{predictions[key]?.occupancy}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">ADR</p>
                            <p className="text-lg font-semibold text-success">${predictions[key]?.adr}</p>
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

        <Card className="border-warning/20 bg-warning-background">
          <CardContent className="py-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
              <div>
                <p className="font-semibold text-foreground">Warning: This action cannot be undone</p>
                <p className="text-sm text-text-secondary">Once submitted, your forecast is locked and cannot be edited.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex space-x-4">
          <Button variant="outline" onClick={() => setShowReview(false)} className="flex-1">
            Go Back & Edit
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? (
              'Submitting...'
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Confirm & Submit
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Round {currentRound.number} Submission</h1>
          <p className="text-text-secondary">Deadline: {formatDeadline(currentRound.closesAt)} ET</p>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-warning" />
          <Badge variant="warning" className="px-3 py-1 text-sm font-medium">
            {timeRemaining}
          </Badge>
        </div>
      </div>

      {hasExisting && (
        <Card className="border-success/20 bg-gradient-to-r from-success-background to-info-background">
          <CardContent className="flex items-center space-x-3 py-4">
            <div className="rounded-full bg-card p-2">
              <Lock className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Submission Locked</p>
              <p className="text-sm text-text-secondary">Your forecast has been submitted and cannot be edited.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {!hasExisting && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">Progress:</span>
                <span className="font-semibold text-foreground">
                  {getFilledCount()} / {getTotalRequired()}
                </span>
                <span className="text-sm text-muted-foreground">values entered</span>
              </div>
              <div className="h-2 w-48 rounded-full bg-surface-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(getFilledCount() / getTotalRequired()) * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex space-x-2 border-b border-border">
        {markets.map((market) => (
          <button
            key={market.id}
            onClick={() => setActiveMarket(market.id)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeMarket === market.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>{market.name}</span>
            </div>
          </button>
        ))}
      </div>

      {markets
        .filter((market) => market.id === activeMarket)
        .map((market) => (
          <Card key={market.id}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span>{market.name}</span>
              </CardTitle>
              <CardDescription>Enter your predictions for occupancy and ADR ($)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {(currentRound.isFinal ? [1] : [1, 2]).map((week) => {
                  const key = `${market.id}-${week}`
                  return (
                    <div key={week} className="rounded-xl border border-border bg-surface-secondary p-6">
                      <h4 className="mb-4 flex items-center space-x-2 font-semibold text-foreground">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                          +{week}
                        </span>
                        <span>Week +{week}</span>
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-occupancy`}>Occupancy</Label>
                          <Input
                            id={`${key}-occupancy`}
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="e.g., 72.5"
                            value={predictions[key]?.occupancy || ''}
                            onChange={(event) =>
                              setPredictions({
                                ...predictions,
                                [key]: { ...predictions[key], occupancy: event.target.value },
                              })
                            }
                            disabled={hasExisting}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${key}-adr`} className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-success" />
                            <span>ADR ($)</span>
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                            <Input
                              id={`${key}-adr`}
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="e.g., 145.00"
                              value={predictions[key]?.adr || ''}
                              onChange={(event) =>
                                setPredictions({
                                  ...predictions,
                                  [key]: { ...predictions[key], adr: event.target.value },
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
          <Button size="lg" onClick={() => setShowReview(true)} disabled={!isFormComplete()} className="min-w-[200px]">
            Review Submission
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
