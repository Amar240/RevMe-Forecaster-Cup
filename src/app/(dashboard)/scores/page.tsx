'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, CheckCircle, AlertCircle, TrendingDown, BarChart3, Filter, ChevronDown, ChevronUp, Download, TrendingUp, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/skeleton'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { StatCard } from '@/components/ui/stat-card'
import { formatMape } from '@/lib/learning-analytics'
import { CohortBandChart } from '@/components/charts/CohortBandChart'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MotionReveal } from '@/components/ui/motion-reveal'
import { OneTimeCelebration } from '@/components/ui/one-time-celebration'

const ScoreTrendChart = dynamic(
  () => import('@/components/charts/ScoreTrendChart').then((mod) => mod.ScoreTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-lg bg-surface-secondary animate-pulse" />
    ),
  }
)

interface Score {
  id: string
  occupancyAE: number
  adrAE: number
  occupancyAPE?: number | null
  adrAPE?: number | null
}

interface Submission {
  id: string
  occupancy: number
  adr: number
  weekOffset: number
  submittedAt: string
  round: { id?: string; number: number }
  market: { name: string }
  score: Score | null
}

interface Team {
  name: string
  displayId: string
}

interface TrendData {
  round: string
  occupancy: number
  adr: number
}

type ScoreInsights = {
  biases: Array<{ key: string; marketName?: string; metric: string; direction: string; observations: number; averageSignedError: number | null }>
  horizon: { week1: number | null; week2: number | null }
  cohortBands: Array<{ roundId: string; round: number; q1: number | null; median: number | null; q3: number | null; team: number | null }>
  markets: Array<{ marketId: string; marketName: string; mape: number | null; occupancyMape: number | null; adrMape: number | null; rounds: Array<{ round: number; mape: number | null }> }>
  takeaway: string
}

export default function ScoresPage() {
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<Team | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [expandedRounds, setExpandedRounds] = useState<number[]>([])
  const [filterMarket, setFilterMarket] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'overview' | 'round' | 'market' | 'export'>('overview')
  const [insights, setInsights] = useState<ScoreInsights | null>(null)
  const [role, setRole] = useState('STUDENT')
  const [availableTeams, setAvailableTeams] = useState<Array<{ id: string; name: string; displayId: string }>>([])
  const [selectedTeamId, setSelectedTeamId] = useState('')

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'overview' || tab === 'round' || tab === 'market' || tab === 'export') setActiveTab(tab)
    fetchScores()
  }, [])

  const fetchScores = async (requestedTeamId?: string) => {
    try {
      setLoading(true)
      const userRes = await csrfFetch('/api/users/me')
      let teamId = requestedTeamId || ''

      if (userRes.ok) {
        const userData = await userRes.json()
        const userRole = userData.user?.role || 'STUDENT'
        setRole(userRole)
        const teamMembership = userData.user?.teamMemberships?.[0]
        if (userRole === 'SUPERVISOR') {
          const teamsRes = await csrfFetch('/api/teams')
          const teamsData = teamsRes.ok ? await teamsRes.json() : { teams: [] }
          const scopedTeams = teamsData.teams || []
          setAvailableTeams(scopedTeams)
          teamId = teamId && scopedTeams.some((item: { id: string }) => item.id === teamId) ? teamId : scopedTeams[0]?.id || ''
          setSelectedTeamId(teamId)
          setTeam(scopedTeams.find((item: { id: string }) => item.id === teamId) || null)
        } else if (teamMembership) {
          setTeam(teamMembership.team)
        }
      }

      const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
      const [subRes, trendRes, insightRes] = await Promise.all([
        csrfFetch(`/api/submissions/history${query}`),
        csrfFetch(`/api/scores/trends${query}`),
        csrfFetch(`/api/scores/insights${query}`),
      ])

      if (subRes.ok) {
        const subData = await subRes.json()
        setSubmissions(subData.submissions || [])
        if (subData.submissions?.length > 0) {
          const latestRound = Math.max(...subData.submissions.map((s: Submission) => s.round.number))
          setExpandedRounds([latestRound])
        }
      }

      if (trendRes.ok) {
        const trendData = await trendRes.json()
        setTrends(trendData.trends || [])
      }
      if (insightRes.ok) {
        const insightData = await insightRes.json()
        setInsights(insightData.insights || null)
        if (insightData.team) setTeam(insightData.team)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch scores:', error)
      toast.error('Failed to load scores')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const res = await csrfFetch(`/api/submissions/export${selectedTeamId ? `?teamId=${encodeURIComponent(selectedTeamId)}` : ''}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'submission-history.csv'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
      }
    } catch (error) {
      clientLogger.error('Failed to download:', error)
      toast.error('Failed to download scores')
    }
  }

  const toggleRound = (roundNum: number) => {
    setExpandedRounds((prev) =>
      prev.includes(roundNum) ? prev.filter((r) => r !== roundNum) : [...prev, roundNum]
    )
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          </CardHeader>
          <CardContent>
            <ChartSkeleton height={250} />
          </CardContent>
        </Card>
        <TableSkeleton rows={3} columns={6} />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-text-muted" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Not on a Team</h3>
            <p className="text-text-secondary">You need to be added to a team to view scores.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const submissionsByRound = submissions.reduce(
    (acc, sub) => {
      const roundNum = sub.round.number
      if (!acc[roundNum]) acc[roundNum] = []
      acc[roundNum].push(sub)
      return acc
    },
    {} as Record<number, Submission[]>
  )

  const filteredSubmissionsByRound = Object.entries(submissionsByRound).reduce(
    (acc, [roundNum, subs]) => {
      const filtered = filterMarket === 'all' ? subs : subs.filter((s) => s.market.name === filterMarket)
      if (filtered.length > 0) acc[parseInt(roundNum)] = filtered
      return acc
    },
    {} as Record<number, Submission[]>
  )

  const scoredSubmissions = submissions.filter((s) => s.score)
  const totalOccupancyAPE = scoredSubmissions.reduce((sum, s) => sum + (s.score?.occupancyAPE || 0), 0)
  const totalAdrAPE = scoredSubmissions.reduce((sum, s) => sum + (s.score?.adrAPE || 0), 0)
  const scoredCount = scoredSubmissions.length

  const markets = [...new Set(submissions.map((s) => s.market.name))]
  const combinedTrends = trends.map((item) => (item.occupancy + item.adr) / 2)
  const personalBest = combinedTrends.length >= 2 && combinedTrends.at(-1)! < Math.min(...combinedTrends.slice(0, -1))

  return (
    <MotionReveal className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Scores</h1>
          <p className="text-text-secondary">Team: {team.name}</p>
        </div>
        {role === 'SUPERVISOR' && availableTeams.length > 0 && <label className="flex w-full flex-col gap-1 text-sm font-medium text-text-secondary sm:w-auto">Team<select value={selectedTeamId} onChange={(event) => { setSelectedTeamId(event.target.value); void fetchScores(event.target.value) }} className="h-11 rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{availableTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}><TabsList aria-label="Score views">{([['overview','Overview'],['round','By round'],['market','By market'],['export','Export']] as const).map(([key, label]) => <TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}</TabsList></Tabs>
      <OneTimeCelebration eventKey={personalBest && team ? `${team.displayId}:personal-best:${trends.at(-1)?.round}` : null}>New personal best: your latest combined published MAPE is your lowest yet.</OneTimeCelebration>
      <MotionReveal key={activeTab} className="space-y-8">

      {activeTab === 'overview' && <>
      <div className="grid md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-surface-secondary to-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Submissions</CardTitle>
            <div className="rounded-lg bg-surface-secondary p-2">
              <FileText className="h-5 w-5 text-text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-foreground">{submissions.length}</p>
            <p className="text-sm text-text-secondary">{scoredCount} scored</p>
          </CardContent>
        </Card>

        <Card className="border-accent/30 bg-gradient-to-br from-accent-soft to-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Final Score</CardTitle>
            <div className="rounded-lg bg-accent-soft p-2">
              <Trophy className="h-5 w-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-accent">
              {scoredCount > 0
                ? ((((totalOccupancyAPE / scoredCount) + (totalAdrAPE / scoredCount)) / 2) * 100).toFixed(2) + '%'
                : '-'}
            </p>
            <p className="text-sm text-text-secondary">(Occupancy MAPE + ADR MAPE) / 2</p>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-primary-soft to-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Occupancy MAPE</CardTitle>
            <div className="p-2 bg-primary-soft rounded-lg">
              <TrendingDown className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">
              {scoredCount > 0 ? `${((totalOccupancyAPE / scoredCount) * 100).toFixed(2)}%` : '-'}
            </p>
            <p className="text-sm text-text-secondary">lower is better</p>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-gradient-to-br from-success-background to-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">ADR MAPE</CardTitle>
            <div className="rounded-lg bg-success-background p-2">
              <BarChart3 className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-success">
              {scoredCount > 0 ? ((totalAdrAPE / scoredCount) * 100).toFixed(2) + '%' : '-'}
            </p>
            <p className="text-sm text-text-secondary">lower is better</p>
          </CardContent>
        </Card>
      </div>

      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Score Trends</span>
            </CardTitle>
            <CardDescription>Your MAPE scores across rounds (lower is better)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={trends} height={280} />
          </CardContent>
        </Card>
      )}
      {insights && <><div className="grid gap-4 md:grid-cols-2"><StatCard title="Week +1 accuracy" value={formatMape(insights.horizon.week1)} description="Published prediction errors" /><StatCard title="Week +2 accuracy" value={formatMape(insights.horizon.week2)} description="Longer horizons usually carry more uncertainty" /></div><Card className="border-primary/20"><CardHeader><CardTitle>What the numbers suggest</CardTitle></CardHeader><CardContent><p>{insights.takeaway}</p>{insights.biases.slice(0, 3).map((bias) => <div key={bias.key} className="mt-4"><div className="flex items-center justify-between text-sm"><span>{bias.marketName} {bias.metric === 'ADR' ? 'ADR' : 'occupancy'}</span><strong>{bias.direction === 'OVER' ? 'Over' : 'Under'} by {formatMape(Math.abs(bias.averageSignedError ?? 0))}</strong></div><div className="relative mt-2 h-2 rounded-full bg-surface-secondary" aria-label={`${bias.direction.toLowerCase()} forecast bias ${formatMape(Math.abs(bias.averageSignedError ?? 0))}`}><span className="absolute left-1/2 top-[-3px] h-4 w-px bg-border" /><span className={`absolute top-0 h-2 rounded-full ${bias.direction === 'OVER' ? 'left-1/2 bg-warning' : 'right-1/2 bg-info'}`} style={{ width: `${Math.min(50, Math.abs(bias.averageSignedError ?? 0) * 200)}%` }} /></div></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Your trend against the cohort</CardTitle><CardDescription>Combined MAPE; lower is better. Team names are not exposed.</CardDescription></CardHeader><CardContent><CohortBandChart data={insights.cohortBands} /></CardContent></Card><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{insights.markets.map((market) => <Card key={market.marketId}><CardHeader><CardTitle>{market.marketName}</CardTitle><CardDescription>Market accuracy</CardDescription></CardHeader><CardContent><p className="font-display text-3xl font-semibold tabular-nums">{formatMape(market.mape)}</p><div className="mt-3 flex justify-between text-sm text-text-secondary"><span>Occupancy {formatMape(market.occupancyMape)}</span><span>ADR {formatMape(market.adrMape)}</span></div></CardContent></Card>)}</div></>}
      </>}

      {(activeTab === 'market') && markets.length > 1 && (
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-text-muted" />
          <span className="text-sm text-text-secondary">Filter by market:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterMarket('all')}
              className={`min-h-11 rounded-full px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                filterMarket === 'all'
                  ? 'bg-primary-soft text-primary'
                  : 'bg-surface-secondary text-text-secondary hover:bg-muted'
              }`}
            >
              All
            </button>
            {markets.map((market) => (
              <button
                key={market}
                onClick={() => setFilterMarket(market)}
                className={`min-h-11 rounded-full px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  filterMarket === market
                    ? 'bg-primary-soft text-primary'
                    : 'bg-surface-secondary text-text-secondary hover:bg-muted'
                }`}
              >
                {market}
              </button>
            ))}
          </div>
        </div>
      )}

      {(activeTab === 'round' || activeTab === 'market') && <>
      {Object.keys(filteredSubmissionsByRound).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-text-muted" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Submissions Yet</h3>
            <p className="text-text-secondary">Your team hasn&apos;t submitted any forecasts yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredSubmissionsByRound)
            .sort(([a], [b]) => parseInt(b) - parseInt(a))
            .map(([roundNum, subs]) => {
              const isExpanded = expandedRounds.includes(parseInt(roundNum))
              const hasScores = subs.some((s) => s.score)
              const roundOccMAPE = hasScores
                ? subs.reduce((sum, s) => sum + (s.score?.occupancyAPE || 0), 0) / subs.filter((s) => s.score).length
                : null
              const roundAdrMAPE = hasScores
                ? subs.reduce((sum, s) => sum + (s.score?.adrAPE || 0), 0) / subs.filter((s) => s.score).length
                : null
              const roundFinalMAPE =
                roundOccMAPE !== null && roundAdrMAPE !== null ? (roundOccMAPE + roundAdrMAPE) / 2 : null

              return (
                <Card key={roundNum} className="overflow-hidden">
                  <button
                    onClick={() => toggleRound(parseInt(roundNum))}
                    className="w-full text-left"
                  >
                    <CardHeader className="bg-surface-secondary hover:bg-surface-secondary transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <CardTitle>Round {roundNum}</CardTitle>
                          {hasScores ? (
                            <span className="flex items-center text-sm text-success bg-success-background px-2 py-1 rounded-full">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Scored
                            </span>
                          ) : (
                            <span className="text-sm text-text-secondary bg-muted px-2 py-1 rounded-full">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-6">
                          {hasScores && (
                            <div className="flex space-x-4 text-sm">
                              <span className="text-primary">
                                Occ: {roundOccMAPE !== null ? `${(roundOccMAPE * 100).toFixed(2)}%` : '--'}
                              </span>
                              <span className="text-success">
                                ADR: {roundAdrMAPE !== null ? `${(roundAdrMAPE * 100).toFixed(2)}%` : '--'}
                              </span>
                              {roundFinalMAPE !== null && (
                                <span className="text-accent">Final: {(roundFinalMAPE * 100).toFixed(2)}%</span>
                              )}
                            </div>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-text-muted" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-text-muted" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>
                  {isExpanded && (
                    <CardContent className="p-0">
                      {hasScores && subs[0]?.round.id && <div className="flex justify-end border-b border-border px-6 py-3"><Link href={`/debrief/${subs[0].round.id}`} className="text-sm font-semibold text-primary">Review Round {roundNum} debrief →</Link></div>}
                      <div className="space-y-3 p-4 md:hidden">{subs.map((sub) => <div key={sub.id} className="rounded-xl border border-border bg-surface-secondary p-4"><div className="flex justify-between"><strong>{sub.market.name}</strong><span className="text-sm text-text-muted">Week +{sub.weekOffset}</span></div><dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-text-muted">Occupancy</dt><dd className="font-mono tabular-nums">{sub.occupancy.toFixed(2)}</dd></div><div><dt className="text-text-muted">ADR</dt><dd className="font-mono tabular-nums">${sub.adr.toFixed(2)}</dd></div>{sub.score && <><div><dt className="text-text-muted">Occupancy error</dt><dd className="font-mono tabular-nums text-primary">{sub.score.occupancyAE.toFixed(2)}</dd></div><div><dt className="text-text-muted">ADR error</dt><dd className="font-mono tabular-nums text-success">${sub.score.adrAE.toFixed(2)}</dd></div></>}</dl></div>)}</div>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-sm">
                          <caption className="sr-only">Round {roundNum} forecast values and published errors</caption>
                          <thead>
                            <tr className="text-left text-text-secondary border-b border-border bg-surface-secondary">
                              <th className="px-6 py-3">Market</th>
                              <th className="px-6 py-3">Week</th>
                              <th className="px-6 py-3 text-right">Occupancy</th>
                              <th className="px-6 py-3 text-right">ADR</th>
                              {hasScores && (
                                <>
                                  <th className="px-6 py-3 text-right">Occ AE</th>
                                  <th className="px-6 py-3 text-right">ADR AE</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {subs.map((sub) => (
                              <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-surface-secondary">
                                <td className="px-6 py-4 font-medium">{sub.market.name}</td>
                                <td className="px-6 py-4">
                                  <span className="bg-surface-secondary px-2 py-1 rounded text-text-secondary">
                                    +{sub.weekOffset}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">{sub.occupancy.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right">${sub.adr.toFixed(2)}</td>
                                {sub.score && (
                                  <>
                                    <td className="px-6 py-4 text-right text-primary font-medium">
                                      {sub.score.occupancyAE.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-success font-medium">
                                      ${sub.score.adrAE.toFixed(2)}
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
        </div>
      )}
      </>}
      {activeTab === 'export' && <Card><CardHeader><CardTitle>Export your forecast history</CardTitle><CardDescription>Download predictions and published score details as CSV.</CardDescription></CardHeader><CardContent><Button onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Download CSV</Button></CardContent></Card>}
      </MotionReveal>
    </MotionReveal>
  )
}
