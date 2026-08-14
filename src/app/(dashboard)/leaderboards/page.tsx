'use client'

import { clientLogger } from '@/lib/client-logger'
import { getLeaderboard } from '@/features/leaderboards/api'
import type { LeaderboardEntry, LeaderboardResponse, RoundInfo } from '@/features/leaderboards/types'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Medal, Users, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { TrendCue } from '@/components/ui/trend-cue'
import { formatMape } from '@/lib/learning-analytics'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { MotionReveal } from '@/components/ui/motion-reveal'
import { OneTimeCelebration } from '@/components/ui/one-time-celebration'

function MiniSparkline({ scores, roundIds }: { scores: Record<string, number>; roundIds: string[] }) {
  const data = roundIds
    .filter((id) => scores[id] !== undefined)
    .map((id) => ({ v: scores[id] * 100, r: roundIds.indexOf(id) + 1 }))
  if (data.length < 2) return null
  const isImproving = data[data.length - 1].v <= data[0].v
  return (
    <Tooltip label={`Published progression: ${data.map((item) => `R${item.r} ${item.v.toFixed(2)}%`).join(' → ')}. ${isImproving ? 'Improving' : 'Higher MAPE'} overall.`}><span className="inline-block align-middle ml-2" style={{ width: 48, height: 20 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={isImproving ? 'hsl(var(--success))' : 'hsl(var(--error))'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </span></Tooltip>
  )
}

function PodiumCard({ rank, name, subtitle, score, visible }: { rank: 1 | 2 | 3; name: string; subtitle?: string; score: number | null; visible: boolean }) {
  const first = rank === 1
  const Icon = first ? Trophy : Medal
  const iconClass = first ? 'text-accent' : rank === 2 ? 'text-medal-silver' : 'text-medal-bronze'
  const background = first ? 'from-accent-soft' : rank === 2 ? 'from-surface-secondary' : 'from-warning-background'
  return <MotionReveal delay={rank * .06} className={`${first ? 'order-1 md:order-2' : rank === 2 ? 'order-2 md:order-1' : 'order-3'} col-span-3 md:col-span-1`}><Card className={`h-full border-border bg-gradient-to-b ${background} via-card to-card`}><CardContent className={`${first ? 'pb-6 pt-8' : 'pb-4 pt-6'} text-center`}><div className={`mx-auto mb-3 flex ${first ? 'h-20 w-20' : 'h-16 w-16'} items-center justify-center rounded-full bg-surface-secondary shadow-sm`}><Icon className={`${first ? 'h-10 w-10' : 'h-8 w-8'} ${iconClass}`} /></div><p className={`mb-1 font-display ${first ? 'text-2xl' : 'text-lg'} font-semibold`}>{name}</p>{subtitle && <p className="mb-2 text-sm text-text-secondary">{subtitle}</p>}<Badge variant={rank === 1 ? 'medal' : rank === 2 ? 'secondary' : 'warning'}>{rank}{rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd'} Place</Badge>{visible && <p className={`mt-3 font-mono ${first ? 'text-2xl text-accent' : 'text-xl text-text-secondary'} font-semibold tabular-nums`}>{formatMape(score)}</p>}</CardContent></Card></MotionReveal>
}

export default function LeaderboardsPage() {
  const [loading, setLoading] = useState(true)
  const [occupancyLeaderboard, setOccupancyLeaderboard] = useState<LeaderboardEntry[]>([])
  const [adrLeaderboard, setAdrLeaderboard] = useState<LeaderboardEntry[]>([])
  const [finalScoreLeaderboard, setFinalScoreLeaderboard] = useState<LeaderboardEntry[]>([])
  const [rounds, setRounds] = useState<RoundInfo[]>([])
  const [seasonName, setSeasonName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'final' | 'occupancy' | 'adr'>('final')
  const [viewMode, setViewMode] = useState<'team' | 'university'>('team')
  const [showProgression, setShowProgression] = useState(false)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [positions, setPositions] = useState<Record<'final' | 'occupancy' | 'adr', LeaderboardResponse['myPosition']>>({ final: null, occupancy: null, adr: null })
  const [nextUnpublishedRound, setNextUnpublishedRound] = useState<LeaderboardResponse['nextUnpublishedRound']>(null)

  useEffect(() => {
    fetchLeaderboards()
  }, [])

  const fetchLeaderboards = async () => {
    try {
      const [occData, adrData, finalData] = await Promise.all([
        getLeaderboard('OCCUPANCY'),
        getLeaderboard('ADR'),
        getLeaderboard('COMBINED'),
      ])

      setOccupancyLeaderboard(occData.leaderboard || [])
      setSeasonName(occData.seasonName || '')
      setMyTeamId(occData.myTeamId || null)
      setRounds(occData.rounds || [])
      setNextUnpublishedRound(occData.nextUnpublishedRound || null)

      setAdrLeaderboard(adrData.leaderboard || [])
      setFinalScoreLeaderboard(finalData.leaderboard || [])
      setPositions({ final: finalData.myPosition, occupancy: occData.myPosition, adr: adrData.myPosition })
    } catch (error) {
      clientLogger.error('Failed to fetch leaderboard:', error)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const currentLeaderboard = activeTab === 'final' 
    ? finalScoreLeaderboard 
    : activeTab === 'occupancy' 
      ? occupancyLeaderboard 
      : adrLeaderboard
  const canSeeLeaderboardValues = currentLeaderboard.some((entry) => entry.mape !== null)

  const scoredRounds = rounds.filter((r) => {
    const hasScores = currentLeaderboard.some((entry) => entry.cumulativeScores[r.id] !== undefined)
    return hasScores
  })

  const sortedRoundIds = useMemo(() => {
    return [...rounds].sort((a, b) => a.number - b.number).map((r) => r.id)
  }, [rounds])

  const getUniversityLeaderboard = () => {
    const universityScores = new Map<string, { university: string; totalMAPE: number; count: number; teams: number }>()

    currentLeaderboard.forEach((entry) => {
      const existing = universityScores.get(entry.university) || {
        university: entry.university,
        totalMAPE: 0,
        count: 0,
        teams: 0,
      }
      existing.teams += 1
      if (entry.mape !== null) {
        existing.totalMAPE += entry.mape
        existing.count += 1
      }
      universityScores.set(entry.university, existing)
    })

    const sorted = Array.from(universityScores.values())
      .map((u) => ({
        rank: 0,
        university: u.university,
        avgMAPE: u.count > 0 ? u.totalMAPE / u.count : null,
        teamCount: u.teams,
      }))

    sorted.sort((a, b) => {
      if (a.avgMAPE === null) return 1
      if (b.avgMAPE === null) return -1
      return a.avgMAPE - b.avgMAPE
    })

    return sorted.map((u, index) => ({ ...u, rank: index + 1 }))
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-accent" />
    if (rank === 2) return <Medal className="h-6 w-6 text-medal-silver" />
    if (rank === 3) return <Medal className="h-6 w-6 text-medal-bronze" />
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const universityLeaderboard = getUniversityLeaderboard()
  const top3 = viewMode === 'team' ? currentLeaderboard.slice(0, 3) : universityLeaderboard.slice(0, 3)
  const hasOperationalSeason = Boolean(seasonName)

  return (
    <MotionReveal className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Leaderboards</h1>
          <p className="text-text-secondary">
            {hasOperationalSeason ? `${seasonName} rankings` : 'No operational season available'}
          </p>
        </div>
        <div className="flex w-full items-center space-x-2 rounded-lg border border-border bg-surface-secondary p-1 sm:w-auto">
          <button
            onClick={() => setViewMode('team')}
            className={`flex min-h-11 flex-1 items-center justify-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              viewMode === 'team' ? 'bg-card text-foreground shadow-sm' : 'text-text-secondary hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Teams</span>
          </button>
          <button
            onClick={() => setViewMode('university')}
            className={`flex min-h-11 flex-1 items-center justify-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              viewMode === 'university' ? 'bg-card text-foreground shadow-sm' : 'text-text-secondary hover:text-foreground'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Universities</span>
          </button>
        </div>
      </div>

      {currentLeaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Trophy className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">
              {hasOperationalSeason ? 'No Scores Yet' : 'No Operational Season Yet'}
            </h3>
            <p className="text-text-secondary">
              {hasOperationalSeason
                ? nextUnpublishedRound
                  ? `Round ${nextUnpublishedRound.number} is ${nextUnpublishedRound.status.toLowerCase()}. Rankings publish after the round closes and scores pass administrator review.`
                  : 'Leaderboards will appear after scores are calculated and published.'
                : 'Leaderboards will appear after a season is activated or resumed and scores are published.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <OneTimeCelebration eventKey={positions[activeTab]?.rankMovement && positions[activeTab]!.rankMovement! > 0 ? `${seasonName}:${activeTab}:rank-up:${positions[activeTab]!.rank}` : null}>Your team moved up {positions[activeTab]?.rankMovement} rank{positions[activeTab]?.rankMovement === 1 ? '' : 's'}.</OneTimeCelebration>
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-4">
              {top3.map((entry, index) => <PodiumCard key={viewMode === 'team' ? (entry as LeaderboardEntry).teamId : (entry as { university: string }).university} rank={(index + 1) as 1 | 2 | 3} name={viewMode === 'team' ? (entry as LeaderboardEntry).teamName : (entry as { university: string }).university} subtitle={viewMode === 'team' ? (entry as LeaderboardEntry).university : undefined} score={viewMode === 'team' ? (entry as LeaderboardEntry).mape : (entry as { avgMAPE: number | null }).avgMAPE} visible={canSeeLeaderboardValues} />)}
            </div>
          )}

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}><TabsList>
            {[
              { key: 'final', label: 'Cumulative Score', activeClass: 'border-accent text-accent' },
              { key: 'occupancy', label: 'Occupancy', activeClass: 'border-primary text-primary' },
              { key: 'adr', label: 'ADR', activeClass: 'border-success text-success' },
            ].map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
              >
                {tab.label}
              </TabsTrigger>
            ))}
            <Tooltip label="Rankings use published MAPE. Lower is better; combined score equally weights occupancy and ADR."><span className="ml-auto flex min-h-11 items-center gap-1 px-3 text-sm text-text-secondary"><Info className="h-4 w-4" />How scoring works</span></Tooltip>
          </TabsList></Tabs>

          {viewMode === 'team' && positions[activeTab] && <Card className="border-primary/20 bg-primary-soft"><CardContent className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Your position</p><p className="font-display text-2xl font-semibold tabular-nums">#{positions[activeTab]!.rank} · {positions[activeTab]!.percentile}th percentile</p></div><div className="flex flex-wrap items-center gap-5"><TrendCue delta={positions[activeTab]!.rankMovement} />{positions[activeTab]!.gapToNext != null && <span className="text-sm tabular-nums">{formatMape(positions[activeTab]!.gapToNext)} behind the next rank</span>}<span className="text-sm"><GlossaryTerm term="MAPE" /> · lower is better</span></div></CardContent></Card>}

          {canSeeLeaderboardValues && scoredRounds.length > 0 && viewMode === 'team' && activeTab !== 'final' && (
            <div className="flex justify-end">
              <Button
                variant={showProgression ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowProgression(!showProgression)}
              >
                {showProgression ? 'Hide' : 'Show'} Round Progression
              </Button>
            </div>
          )}

          <div className="space-y-3 md:hidden">{viewMode === 'team' ? currentLeaderboard.map((entry) => <Card key={entry.teamId} className={entry.teamId === myTeamId ? 'border-primary/30 bg-primary-soft' : ''}><CardContent className="py-4"><div className="flex items-start justify-between gap-3"><div><p className="font-display text-2xl font-semibold tabular-nums">#{entry.rank}</p><p className="font-semibold">{entry.teamName}{entry.teamId === myTeamId && <Badge variant="info" className="ml-2">You</Badge>}</p><p className="text-sm text-text-secondary">{entry.university}</p></div><div className="text-right"><p className="font-mono text-lg font-bold tabular-nums">{formatMape(entry.mape)}</p><p className="text-xs text-text-muted">MAPE · lower is better</p></div></div></CardContent></Card>) : universityLeaderboard.map((entry) => <Card key={entry.university}><CardContent className="flex items-center justify-between py-4"><div><p className="font-display text-2xl font-semibold">#{entry.rank}</p><p className="font-semibold">{entry.university}</p><p className="text-sm text-text-secondary">{entry.teamCount} teams</p></div><p className="font-mono font-bold tabular-nums">{formatMape(entry.avgMAPE)}</p></CardContent></Card>)}</div>
          <Card className="hidden md:block">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
                <caption className="sr-only">{activeTab === 'final' ? 'Combined' : activeTab === 'occupancy' ? 'Occupancy' : 'ADR'} {viewMode} leaderboard; lower MAPE is better</caption>
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {viewMode === 'team' ? 'Team' : 'University'}
                    </th>
                    {viewMode === 'team' && (
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">University</th>
                    )}
          {canSeeLeaderboardValues && showProgression && viewMode === 'team' && activeTab !== 'final' && scoredRounds.map((round) => (
                      <th key={round.id} className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        R{round.number}
                      </th>
                    ))}
                    {canSeeLeaderboardValues && (
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {activeTab === 'final' ? 'Cumulative Score' : activeTab === 'occupancy' ? 'Occupancy MAPE' : 'ADR MAPE'}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {viewMode === 'team'
                    ? currentLeaderboard.map((entry) => (
                        <tr
                          key={entry.teamId}
                          className={entry.teamId === myTeamId ? 'bg-primary-soft' : 'hover:bg-surface-secondary'}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getRankIcon(entry.rank)}
                              <span className={`font-bold ${entry.rank <= 3 ? 'text-lg' : ''}`}>
                                #{entry.rank}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="font-medium text-foreground">{entry.teamName}</span>
                              {entry.teamId === myTeamId && (
                                <Badge variant="info" className="ml-2 px-2 py-0.5">You</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-text-secondary">{entry.university}</td>
                          {canSeeLeaderboardValues && showProgression && activeTab !== 'final' && scoredRounds.map((round) => (
                            <td key={round.id} className="px-3 py-4 whitespace-nowrap text-center font-mono text-sm text-text-secondary">
                              {entry.cumulativeScores[round.id] !== undefined 
                                ? `${(entry.cumulativeScores[round.id] * 100).toFixed(2)}%`
                                : '--'}
                            </td>
                          ))}
                          {canSeeLeaderboardValues && (
                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold">
                              <span className="inline-flex items-center">
                                {entry.mape !== null ? `${(entry.mape * 100).toFixed(2)}%` : '--'}
                                {entry.mape !== null && Object.keys(entry.cumulativeScores).length >= 2 && (
                                  <MiniSparkline scores={entry.cumulativeScores} roundIds={sortedRoundIds} />
                                )}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))
                    : universityLeaderboard.map((entry) => (
                        <tr key={entry.university} className="hover:bg-surface-secondary">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getRankIcon(entry.rank)}
                              <span className={`font-bold ${entry.rank <= 3 ? 'text-lg' : ''}`}>
                                #{entry.rank}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-foreground">{entry.university}</span>
                            <span className="ml-2 text-sm text-text-secondary">({entry.teamCount} teams)</span>
                          </td>
                          {canSeeLeaderboardValues && (
                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-foreground">
                              {entry.avgMAPE !== null ? `${(entry.avgMAPE * 100).toFixed(2)}%` : '--'}
                            </td>
                          )}
                        </tr>
                      ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </MotionReveal>
  )
}
