'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { clientLogger } from '@/lib/client-logger'
import { getCurrentSubmission, submitForecast } from '@/features/submissions/api'
import type { ExistingSubmission, LockReason, MarketInfo, RoundInfo } from '@/features/submissions/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertBanner } from '@/components/ui/alert-banner'
import { getSubmissionMetricError, parseSubmissionMetricInput } from '@/lib/submission-values'
import { predictionsRequired } from '@/lib/competition-config'
import { formatForecastWeekLabel, forecastWeeksSummary } from '@/lib/forecast-weeks'
import { ValidatedNumberField } from '@/components/ui/validated-number-field'
import { contextualWarning, draftKey, draftSavedAt, parseDraft, serializeDraft } from '@/lib/submission-workspace'
import { Sparkline } from '@/components/ui/sparkline'
import { Tooltip } from '@/components/ui/tooltip'
import { DualTimezoneDeadline } from '@/components/dual-timezone-deadline'
import { GlossaryTerm } from '@/components/ui/glossary-term'
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

function getSubmissionValidationError(predictions: Record<string, { occupancy: string; adr: string }>) {
  for (const prediction of Object.values(predictions)) {
    if (parseSubmissionMetricInput('OCCUPANCY', prediction.occupancy) === null) {
      return 'Enter occupancy values as numbers between 0 and 100.'
    }

    if (parseSubmissionMetricInput('ADR', prediction.adr) === null) {
      return 'Enter ADR values as positive numbers.'
    }
  }

  return null
}

type NormalizedSubmission =
  { marketId: string; weekOffset: number; occupancy: number; adr: number }

function buildNormalizedSubmissions(
  predictions: Record<string, { occupancy: string; adr: string }>
): { ok: false; error: string } | { ok: true; submissions: NormalizedSubmission[] } {
  const validationError = getSubmissionValidationError(predictions)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  return {
    ok: true,
    submissions: Object.entries(predictions).map(([key, value]) => {
      const lastDash = key.lastIndexOf('-')
      const marketId = key.slice(0, lastDash)
      const weekOffset = key.slice(lastDash + 1)

      return {
        marketId,
        weekOffset: Number(weekOffset),
        occupancy: parseSubmissionMetricInput('OCCUPANCY', value.occupancy)!,
        adr: parseSubmissionMetricInput('ADR', value.adr)!,
      }
    }),
  }
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export default function SubmitPage() {
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
  const [context, setContext] = useState<{ userId: string; teamId: string; seasonId: string } | null>(null)
  const [evidenceByMarket, setEvidenceByMarket] = useState<NonNullable<import('@/features/submissions/types').CurrentSubmissionResponse['evidenceByMarket']>>({})
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftSavedTime, setDraftSavedTime] = useState<string | null>(null)
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false)

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
      setContext(data.context || null)
      setEvidenceByMarket(data.evidenceByMarket || {})

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
      if (data.context && data.currentRound && !data.existingSubmissions?.length) {
        const storedDraft = localStorage.getItem(draftKey({ ...data.context, roundId: data.currentRound.id }))
        const restored = parseDraft(storedDraft)
        setPredictions(restored ? { ...initialPredictions, ...restored } : initialPredictions)
        setDraftRestored(Boolean(restored))
        setDraftSavedTime(draftSavedAt(storedDraft))
      } else {
        setPredictions(initialPredictions)
        if (data.context && data.currentRound) localStorage.removeItem(draftKey({ ...data.context, roundId: data.currentRound.id }))
      }
    } catch (err) {
      clientLogger.error('Failed to fetch data:', err)
      toast.error('Failed to load submission data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!context || !currentRound || existingSubmissions.length > 0 || loading) return
    const timer = window.setTimeout(() => {
      const serialized = serializeDraft(predictions)
      localStorage.setItem(draftKey({ ...context, roundId: currentRound.id }), serialized)
      setDraftSavedTime(draftSavedAt(serialized))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [context, currentRound, existingSubmissions.length, loading, predictions])

  const handleSubmit = async () => {
    setError('')

    const result = buildNormalizedSubmissions(predictions)
    if (!result.ok) {
      setError(result.error)
      setShowReview(false)
      return
    }

    setSubmitting(true)

    try {
      await submitForecast({ roundId: currentRound?.id || null, submissions: result.submissions })

      if (context && currentRound) localStorage.removeItem(draftKey({ ...context, roundId: currentRound.id }))

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setShowReview(false)
    } finally {
      setSubmitting(false)
    }
  }

  const isFormComplete = () =>
    getSubmissionValidationError(predictions) === null

  // Count only values that are genuinely VALID numbers — not merely non-empty. Previously a field
  // containing "abc" counted as filled, so the progress read "12 of 12" while Review stayed disabled
  // (the confusing behavior from the issues log).
  const getFilledCount = () =>
    Object.values(predictions).reduce(
      (count, prediction) =>
        count
        + (parseSubmissionMetricInput('OCCUPANCY', prediction.occupancy) !== null ? 1 : 0)
        + (parseSubmissionMetricInput('ADR', prediction.adr) !== null ? 1 : 0),
      0
    )

  const getTotalRequired = () => predictionsRequired(markets.length, Boolean(currentRound?.isFinal))

  const contextualWarnings = Object.entries(predictions).flatMap(([key, prediction]) => {
    const lastDash = key.lastIndexOf('-')
    const marketId = key.slice(0, lastDash)
    return [
      contextualWarning(Number(prediction.occupancy), evidenceByMarket[marketId]?.lastActual.occupancy ?? null, 'OCCUPANCY'),
      contextualWarning(Number(prediction.adr), evidenceByMarket[marketId]?.lastActual.adr ?? null, 'ADR'),
    ].filter((warning): warning is string => Boolean(warning))
  })

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
            <p className="text-muted-foreground">A receipt is being sent in the background. While results are prepared, note the assumption you most want to test when actuals arrive.</p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild><Link href="/dashboard">Return to dashboard</Link></Button><Button asChild variant="outline"><Link href="/market-info">Review market context</Link></Button></div>
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
          <p className="text-text-secondary">
            Forecasting {forecastWeeksSummary(currentRound.closesAt, currentRound.isFinal ? [1] : [1, 2])}
          </p>
          <p className="text-sm text-text-muted">Deadline: <DualTimezoneDeadline date={currentRound.closesAt} /></p>
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

        {contextualWarnings.length > 0 && <label className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-background p-4"><input type="checkbox" checked={warningsAcknowledged} onChange={(event) => setWarningsAcknowledged(event.target.checked)} className="mt-1 h-4 w-4" /><span><strong>These values are intentional.</strong><span className="mt-1 block text-sm text-text-secondary">I reviewed {contextualWarnings.length} contextual warning{contextualWarnings.length === 1 ? '' : 's'}. These warnings are guidance and do not replace validation.</span></span></label>}

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
                        <p className="mb-2 text-sm text-muted-foreground">{formatForecastWeekLabel(currentRound.closesAt, week)}</p>
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
                        <h4 className="mb-3 font-medium text-foreground">{formatForecastWeekLabel(currentRound.closesAt, week)}</h4>
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
          <Button onClick={handleSubmit} disabled={submitting || (contextualWarnings.length > 0 && !warningsAcknowledged)} className="flex-1">
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Round {currentRound.number} Submission</h1>
          <p className="text-text-secondary">
            Forecasting {forecastWeeksSummary(currentRound.closesAt, currentRound.isFinal ? [1] : [1, 2])}
          </p>
          <p className="text-sm text-text-muted">Deadline: <DualTimezoneDeadline date={currentRound.closesAt} /></p>
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

      {draftRestored && !hasExisting && <AlertBanner variant="info">Your browser-saved draft was restored.</AlertBanner>}

      {draftSavedTime && !hasExisting && <p role="status" className="text-right text-xs text-text-muted">Draft saved in this browser at {new Date(draftSavedTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>}

      <div className="flex space-x-2 overflow-x-auto border-b border-border">
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
          <div key={market.id} className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span>{market.name}</span>
              </CardTitle>
              <CardDescription>Enter your predictions for <GlossaryTerm term="Occupancy" /> and <GlossaryTerm term="ADR" /> ($)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {(currentRound.isFinal ? [1] : [1, 2]).map((week) => {
                  const key = `${market.id}-${week}`
                  return (
                    <div key={week} className="rounded-xl border border-border bg-surface-secondary p-6">
                      <h4 className="mb-4 flex items-center gap-2 font-semibold text-foreground">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                          +{week}
                        </span>
                        <span>{formatForecastWeekLabel(currentRound.closesAt, week)}</span>
                      </h4>
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <ValidatedNumberField
                            id={`${key}-occupancy`}
                            label="Occupancy"
                            value={predictions[key]?.occupancy ?? ''}
                            onChange={(next) =>
                              setPredictions({
                                ...predictions,
                                [key]: { ...predictions[key], occupancy: next },
                              })
                            }
                            validate={(raw) => getSubmissionMetricError('OCCUPANCY', raw)}
                            disabled={hasExisting}
                            placeholder="e.g., 72.5"
                          />
                          {!hasExisting && predictions[key]?.occupancy && contextualWarning(Number(predictions[key].occupancy), evidenceByMarket[market.id]?.lastActual.occupancy ?? null, 'OCCUPANCY') && <p className="rounded-md bg-warning-background px-2 py-1 text-xs text-warning">⚠ {contextualWarning(Number(predictions[key].occupancy), evidenceByMarket[market.id]?.lastActual.occupancy ?? null, 'OCCUPANCY')}</p>}
                        </div>
                        <div className="space-y-1.5">
                          <ValidatedNumberField
                            id={`${key}-adr`}
                            label={<><DollarSign className="h-4 w-4 text-success" /><span>ADR ($)</span></>}
                            labelClassName="flex items-center space-x-2"
                            value={predictions[key]?.adr ?? ''}
                            onChange={(next) =>
                              setPredictions({
                                ...predictions,
                                [key]: { ...predictions[key], adr: next },
                              })
                            }
                            validate={(raw) => getSubmissionMetricError('ADR', raw)}
                            disabled={hasExisting}
                            placeholder="e.g., 145.00"
                            prefix="$"
                            formatOnBlur={(raw) => {
                              const parsed = parseSubmissionMetricInput('ADR', raw)
                              return parsed === null ? raw : parsed.toFixed(2)
                            }}
                          />
                          {!hasExisting && predictions[key]?.adr && contextualWarning(Number(predictions[key].adr), evidenceByMarket[market.id]?.lastActual.adr ?? null, 'ADR') && <p className="rounded-md bg-warning-background px-2 py-1 text-xs text-warning">⚠ {contextualWarning(Number(predictions[key].adr), evidenceByMarket[market.id]?.lastActual.adr ?? null, 'ADR')}</p>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="h-fit lg:sticky lg:top-6"><CardHeader><CardTitle>Evidence panel</CardTitle><CardDescription>Published information for {market.name}</CardDescription></CardHeader><CardContent><details open className="group"><summary className="mb-4 cursor-pointer text-sm font-semibold text-primary lg:hidden">Show or hide evidence</summary><div className="space-y-4">{evidenceByMarket[market.id] ? <>
            <div className="rounded-lg bg-surface-secondary p-3"><p className="text-xs font-semibold uppercase text-text-muted">Recent actuals</p><div className="mt-2 grid grid-cols-2 gap-2 tabular-nums"><div><p className="text-xs text-text-muted">Occupancy average</p><p className="font-semibold">{evidenceByMarket[market.id].trailingAverage.occupancy?.toFixed(1) ?? '—'}%</p></div><div><p className="text-xs text-text-muted">ADR average</p><p className="font-semibold">${evidenceByMarket[market.id].trailingAverage.adr?.toFixed(0) ?? '—'}</p></div></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="text-primary"><p className="mb-1 text-xs text-text-muted">Occupancy trend</p><Sparkline label="Recent occupancy actuals" values={evidenceByMarket[market.id].actuals.filter((item) => item.metric === 'OCCUPANCY').slice().reverse().map((item) => item.value)} /></div><div className="text-success"><p className="mb-1 text-xs text-text-muted">ADR trend</p><Sparkline label="Recent ADR actuals" values={evidenceByMarket[market.id].actuals.filter((item) => item.metric === 'ADR').slice().reverse().map((item) => item.value)} /></div></div>
            {evidenceByMarket[market.id].latestError && <div className="rounded-lg border border-border p-3"><p className="text-xs text-text-muted">Your last published result here</p><p className="text-sm font-medium">{evidenceByMarket[market.id].latestError?.direction.toLowerCase()}-forecast {evidenceByMarket[market.id].latestError?.metric === 'ADR' ? 'ADR' : 'occupancy'} in Round {evidenceByMarket[market.id].latestError?.roundNumber}</p></div>}
            {evidenceByMarket[market.id].roundUpdate && <div className="rounded-lg border-l-4 border-accent bg-accent-soft p-3"><p className="font-semibold">{evidenceByMarket[market.id].roundUpdate?.headline}</p><p className="text-sm text-text-secondary">{evidenceByMarket[market.id].roundUpdate?.whatChanged}</p></div>}
            {evidenceByMarket[market.id].marketInfo?.summary && <div><p className="text-xs font-semibold uppercase text-text-muted">Market brief</p><p className="text-sm text-text-secondary">{evidenceByMarket[market.id].marketInfo?.summary}</p><a href={`/market-info?marketId=${market.id}`} className="mt-1 inline-block text-sm text-primary">Full market brief →</a></div>}
            {stringList(evidenceByMarket[market.id].marketInfo?.quickInsights).length > 0 && <div><p className="text-xs font-semibold uppercase text-text-muted">Quick insights</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">{stringList(evidenceByMarket[market.id].marketInfo?.quickInsights).map((insight) => <li key={insight}>{insight}</li>)}</ul></div>}
            {(evidenceByMarket[market.id].marketInfo?.resourceLinks.length ?? 0) > 0 && <div><p className="text-xs font-semibold uppercase text-text-muted">Resources</p><div className="mt-2 flex flex-wrap gap-2">{evidenceByMarket[market.id].marketInfo?.resourceLinks.map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="rounded-full border border-border px-3 py-1 text-xs font-medium text-primary">{resource.label}</a>)}</div></div>}
          </> : <p className="text-sm text-text-secondary">Evidence will appear after published results are available.</p>}</div></details></CardContent></Card>
          </div>
        ))}

      {!hasExisting && (
        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-border bg-background/95 py-4 backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="hidden h-2 w-40 shrink-0 overflow-hidden rounded-full bg-surface-secondary sm:block">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${(getFilledCount() / getTotalRequired()) * 100}%` }} />
            </div>
            <p className="text-sm text-text-secondary">{getFilledCount()} of {getTotalRequired()} values ready</p>
          </div>
          <Tooltip label={isFormComplete() ? 'All required values are ready for review.' : `${Math.max(0, getTotalRequired() - getFilledCount())} required values are missing or invalid.`}><Button size="lg" onClick={() => setShowReview(true)} disabled={!isFormComplete()} className="min-w-[200px]">
            Review Submission
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button></Tooltip>
        </div>
      )}
    </div>
  )
}
