'use client'

import { useEffect, useState } from 'react'
import { csrfFetch } from '@/lib/csrf'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Award, BookOpen, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { TrendCue } from '@/components/ui/trend-cue'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { formatMape } from '@/lib/learning-analytics'
import { MotionReveal } from '@/components/ui/motion-reveal'

type Debrief = {
  round: { id: string; number: number }; team: { name: string }
  summary: { mape: number; rank: number; percentile: number; cohort: number; rankMovement: number | null; distribution: { median: number | null } }
  rows: Array<{ marketId: string; marketName: string; metric: 'OCCUPANCY' | 'ADR'; weekOffset: number; predictedValue: number; actualValue: number; apeError: number | null; absoluteError: number; signedDifference: number; cohortMedianError: number | null }>
  patterns: Array<{ key: string; marketName?: string; metric: string; direction: 'OVER' | 'UNDER'; observations: number; averageSignedError: number | null }>
  horizonPattern: { horizonOne: number; horizonTwo: number; gap: number; needsAttention: boolean } | null
  improvement: { length: number; improving: boolean }
  calls: { best: { marketName?: string; metric: string; weekOffset: number; apeError: number | null } | null; largestMiss: { marketName?: string; metric: string; weekOffset: number; apeError: number | null } | null }
  marketUpdates: Array<{ marketId: string; marketName: string; headline: string; whatChanged: string }>
}

export default function DebriefPage() {
  const { roundId } = useParams<{ roundId: string }>()
  const searchParams = useSearchParams()
  const teamId = searchParams.get('teamId')
  const [data, setData] = useState<Debrief | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { csrfFetch(`/api/debrief/${roundId}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Debrief unavailable'); setData(body.debrief) }).catch((reason) => setError(reason.message)) }, [roundId, teamId])
  if (error) return <Card><CardContent className="py-12 text-center text-text-secondary">{error}</CardContent></Card>
  if (!data) return <div className="py-16 text-center text-text-secondary">Preparing your debrief…</div>
  return <MotionReveal className="space-y-8">
    <div><Link href="/scores" className="mb-4 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="h-4 w-4" />Back to scores</Link><p className="text-sm font-semibold uppercase tracking-wider text-accent">Round {data.round.number} debrief</p><h1 className="font-display text-4xl font-semibold">What your forecast can teach you</h1><p className="mt-2 text-text-secondary">{data.team.name} · results are based only on published scores.</p></div>
    <div className="grid gap-4 md:grid-cols-3"><StatCard title={<GlossaryTerm term="MAPE" />} value={formatMape(data.summary.mape)} description="Lower is better" icon={<Target className="h-5 w-5 text-primary" />} /><StatCard title="Round rank" value={`#${data.summary.rank}`} description={<TrendCue delta={data.summary.rankMovement} />} icon={<Award className="h-5 w-5 text-accent" />} /><StatCard title="Percentile" value={`${data.summary.percentile}th`} description={`Cohort median ${formatMape(data.summary.distribution.median)}`} icon={<BookOpen className="h-5 w-5 text-primary" />} /></div>
    {(data.calls.best || data.calls.largestMiss) && <div className="grid gap-4 md:grid-cols-2">{data.calls.best && <Card className="border-success/30"><CardHeader><CardTitle>Best call</CardTitle></CardHeader><CardContent><p className="font-semibold">{data.calls.best.marketName} · {data.calls.best.metric === 'ADR' ? 'ADR' : 'Occupancy'} · Week +{data.calls.best.weekOffset}</p><p className="text-sm text-text-secondary">{formatMape(data.calls.best.apeError)} error</p></CardContent></Card>}{data.calls.largestMiss && <Card className="border-warning/30"><CardHeader><CardTitle>Largest miss</CardTitle></CardHeader><CardContent><p className="font-semibold">{data.calls.largestMiss.marketName} · {data.calls.largestMiss.metric === 'ADR' ? 'ADR' : 'Occupancy'} · Week +{data.calls.largestMiss.weekOffset}</p><p className="text-sm text-text-secondary">{formatMape(data.calls.largestMiss.apeError)} error — revisit the assumption behind this call.</p></CardContent></Card>}</div>}
    <Card><CardHeader><CardTitle>Forecast vs. actual</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.rows.map((row) => <div key={`${row.marketId}-${row.metric}-${row.weekOffset}`} className="rounded-xl border border-border bg-surface-secondary p-4"><p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{row.marketName} · Week +{row.weekOffset} · {row.metric === 'ADR' ? 'ADR' : 'Occupancy'}</p><div className="mt-2 flex justify-between gap-4 tabular-nums"><span>You: <strong>{row.predictedValue.toFixed(1)}</strong></span><span>Actual: <strong>{row.actualValue.toFixed(1)}</strong></span></div><p className={`mt-2 text-sm ${row.signedDifference > 0 ? 'text-warning' : row.signedDifference < 0 ? 'text-info' : 'text-success'}`}>{row.signedDifference > 0 ? 'Over' : row.signedDifference < 0 ? 'Under' : 'Exact'} by {row.apeError == null ? `${row.absoluteError.toFixed(1)} (actual was zero)` : formatMape(row.apeError)}</p><p className="mt-1 text-xs text-text-muted">Cohort median error: {formatMape(row.cohortMedianError)}</p></div>)}</div></CardContent></Card>
    {(data.horizonPattern || data.improvement.improving) && <div className="grid gap-4 md:grid-cols-2">{data.horizonPattern && <Card><CardHeader><CardTitle>Forecast horizon</CardTitle></CardHeader><CardContent><p>Week +1: <strong>{formatMape(data.horizonPattern.horizonOne)}</strong> · Week +2: <strong>{formatMape(data.horizonPattern.horizonTwo)}</strong></p><p className="mt-2 text-sm text-text-secondary">{data.horizonPattern.needsAttention ? 'Your longer-horizon error is materially higher. Use a wider uncertainty range for week +2.' : 'Your accuracy is holding consistently across both horizons.'}</p></CardContent></Card>}{data.improvement.improving && <Card className="border-success/30"><CardHeader><CardTitle>Improving streak</CardTitle></CardHeader><CardContent>Your combined MAPE improved for {data.improvement.length} consecutive published rounds.</CardContent></Card>}</div>}
    {data.patterns.length > 0 && <Card className="border-primary/20"><CardHeader><CardTitle>Pattern watch</CardTitle></CardHeader><CardContent className="space-y-2">{data.patterns.map((pattern) => <p key={pattern.key}>You consistently {pattern.direction === 'OVER' ? 'over-forecast' : 'under-forecast'} {pattern.marketName} {pattern.metric === 'ADR' ? 'ADR' : 'occupancy'} across {pattern.observations} comparable forecasts. Revisit your baseline before applying event adjustments.</p>)}</CardContent></Card>}
    {data.marketUpdates.length > 0 && <Card className="border-accent/30"><CardHeader><CardTitle>What moved the market</CardTitle></CardHeader><CardContent className="space-y-4">{data.marketUpdates.map((update) => <div key={update.marketId}><p className="font-semibold">{update.marketName}: {update.headline}</p><p className="text-sm text-text-secondary">{update.whatChanged}</p></div>)}</CardContent></Card>}
  </MotionReveal>
}
