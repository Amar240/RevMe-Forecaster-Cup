import { notFound } from 'next/navigation'
import { prisma } from '@/server/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMape, scoreDistribution } from '@/lib/learning-analytics'

export const dynamic = 'force-dynamic'

export default async function SeasonRecapPage({ params }: { params: Promise<{ seasonId: string }> }) {
  const { seasonId } = await params
  const season = await prisma.season.findFirst({ where: { id: seasonId, status: 'COMPLETED' }, select: { id: true, name: true, startDate: true, endDate: true, rounds: { where: { leaderboardVisible: true }, select: { id: true } }, teams: { where: { status: { in: ['ACTIVE', 'APPROVED', 'ARCHIVED'] } }, select: { id: true, university: { select: { name: true } } } }, scoreAggregates: { where: { scopeType: 'SEASON' }, select: { teamId: true, metric: true, mape: true } } } })
  if (!season) notFound()
  const scores = new Map<string, { occupancy?: number; adr?: number }>()
  for (const aggregate of season.scoreAggregates) { const item = scores.get(aggregate.teamId) || {}; if (aggregate.metric === 'OCCUPANCY') item.occupancy = aggregate.mape; else item.adr = aggregate.mape; scores.set(aggregate.teamId, item) }
  const combined = Array.from(scores.values()).flatMap((item) => item.occupancy == null || item.adr == null ? [] : [(item.occupancy + item.adr) / 2]).sort((a, b) => a - b)
  const distribution = scoreDistribution(combined)
  const universities = [...new Set(season.teams.map((team) => team.university.name))]
  return <main className="min-h-screen bg-background px-4 py-12 text-foreground"><div className="mx-auto max-w-5xl space-y-8"><header className="text-center"><p className="text-sm font-semibold uppercase tracking-widest text-accent">Completed season recap</p><h1 className="mt-2 font-display text-5xl font-semibold">{season.name}</h1><p className="mt-3 text-text-secondary">{season.startDate.toLocaleDateString()} – {season.endDate.toLocaleDateString()} · Privacy-safe aggregate results</p></header><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Participating teams" value={String(season.teams.length)} /><Metric label="Universities" value={String(universities.length)} /><Metric label="Rounds published" value={String(season.rounds.length)} /><Metric label="Teams scored" value={String(combined.length)} /></div><div className="grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle>Season accuracy</CardTitle></CardHeader><CardContent className="space-y-3"><Row label="Leading combined MAPE" value={formatMape(combined[0])} /><Row label="Cohort median" value={formatMape(distribution.median)} /><Row label="Middle 50%" value={`${formatMape(distribution.q1)} – ${formatMape(distribution.q3)}`} /><p className="pt-2 text-sm text-text-secondary">MAPE measures forecast error; lower is better. No participant-level forecasts or identities are shown.</p></CardContent></Card><Card><CardHeader><CardTitle>Participating universities</CardTitle></CardHeader><CardContent><ul className="grid grid-cols-2 gap-2 text-sm">{universities.sort().map((name) => <li key={name} className="rounded-lg bg-surface-secondary px-3 py-2">{name}</li>)}</ul></CardContent></Card></div></div></main>
}

function Metric({ label, value }: { label: string; value: string }) { return <Card><CardContent className="py-6 text-center"><p className="font-display text-4xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-sm text-text-secondary">{label}</p></CardContent></Card> }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 border-b border-border pb-3"><span className="text-text-secondary">{label}</span><strong className="font-mono tabular-nums">{value}</strong></div> }
