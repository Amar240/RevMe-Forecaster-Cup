'use client'

import { clientLogger } from '@/lib/client-logger'
import { getLeaderboard } from '@/features/leaderboards/api'
import type { LeaderboardEntry, RoundInfo } from '@/features/leaderboards/types'
import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trophy, Medal, Users, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

function MiniSparkline({ scores, roundIds }: { scores: Record<string, number>; roundIds: string[] }) {
  const data = roundIds
    .filter((id) => scores[id] !== undefined)
    .map((id) => ({ v: scores[id] * 100 }))
  if (data.length < 2) return null
  const isImproving = data[data.length - 1].v <= data[0].v
  return (
    <div className="inline-block align-middle ml-2" style={{ width: 48, height: 20 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={isImproving ? '#16a34a' : '#dc2626'}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
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

      setAdrLeaderboard(adrData.leaderboard || [])
      setFinalScoreLeaderboard(finalData.leaderboard || [])
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Leaderboards</h1>
          <p className="text-text-secondary">
            {hasOperationalSeason ? `${seasonName} rankings` : 'No operational season available'}
          </p>
        </div>
        <div className="flex items-center space-x-2 rounded-lg border border-border bg-surface-secondary p-1">
          <button
            onClick={() => setViewMode('team')}
            className={`flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'team' ? 'bg-card text-foreground shadow-sm' : 'text-text-secondary hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Teams</span>
          </button>
          <button
            onClick={() => setViewMode('university')}
            className={`flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
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
                ? 'Leaderboards will appear after scores are calculated.'
                : 'Leaderboards will appear after a season is activated or resumed and scores are published.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="order-1 col-span-3 border-border bg-gradient-to-b from-accent-soft via-card to-card md:order-2 md:col-span-1">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent-soft shadow-sm">
                    <Trophy className="h-10 w-10 text-accent" />
                  </div>
                  <p className="mb-1 text-2xl font-semibold text-foreground">
                    {viewMode === 'team' ? (top3[0] as LeaderboardEntry).teamName : (top3[0] as { university: string }).university}
                  </p>
                  {viewMode === 'team' && (
                    <p className="mb-3 text-sm text-text-secondary">{(top3[0] as LeaderboardEntry).university}</p>
                  )}
                  <Badge variant="medal" className="px-3 py-1 text-sm">1st Place</Badge>
                  {canSeeLeaderboardValues && (
                    <p className="mt-3 text-2xl font-semibold text-accent">
                      {viewMode === 'team'
                        ? ((top3[0] as LeaderboardEntry).mape !== null ? `${((top3[0] as LeaderboardEntry).mape! * 100).toFixed(2)}%` : '--')
                        : ((top3[0] as { avgMAPE: number | null }).avgMAPE !== null ? `${((top3[0] as { avgMAPE: number | null }).avgMAPE! * 100).toFixed(2)}%` : '--')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="order-2 col-span-3 border-border bg-gradient-to-b from-surface-secondary via-card to-card md:order-1 md:col-span-1">
                <CardContent className="pt-6 pb-4 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-surface-secondary shadow-sm">
                    <Medal className="h-8 w-8 text-medal-silver" />
                  </div>
                  <p className="mb-1 text-lg font-semibold text-foreground">
                    {viewMode === 'team' ? (top3[1] as LeaderboardEntry).teamName : (top3[1] as { university: string }).university}
                  </p>
                  {viewMode === 'team' && (
                    <p className="mb-2 text-sm text-text-secondary">{(top3[1] as LeaderboardEntry).university}</p>
                  )}
                  <Badge variant="secondary" className="px-3 py-1 text-sm">2nd Place</Badge>
                  {canSeeLeaderboardValues && (
                    <p className="mt-2 text-xl font-semibold text-text-secondary">
                      {viewMode === 'team'
                        ? ((top3[1] as LeaderboardEntry).mape !== null ? `${((top3[1] as LeaderboardEntry).mape! * 100).toFixed(2)}%` : '--')
                        : ((top3[1] as { avgMAPE: number | null }).avgMAPE !== null ? `${((top3[1] as { avgMAPE: number | null }).avgMAPE! * 100).toFixed(2)}%` : '--')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="order-3 col-span-3 border-border bg-gradient-to-b from-warning-background via-card to-card md:col-span-1">
                <CardContent className="pt-6 pb-4 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-warning-background shadow-sm">
                    <Medal className="h-8 w-8 text-medal-bronze" />
                  </div>
                  <p className="mb-1 text-lg font-semibold text-foreground">
                    {viewMode === 'team' ? (top3[2] as LeaderboardEntry).teamName : (top3[2] as { university: string }).university}
                  </p>
                  {viewMode === 'team' && (
                    <p className="mb-2 text-sm text-text-secondary">{(top3[2] as LeaderboardEntry).university}</p>
                  )}
                  <Badge variant="warning" className="px-3 py-1 text-sm">3rd Place</Badge>
                  {canSeeLeaderboardValues && (
                    <p className="mt-2 text-xl font-semibold text-warning">
                      {viewMode === 'team'
                        ? ((top3[2] as LeaderboardEntry).mape !== null ? `${((top3[2] as LeaderboardEntry).mape! * 100).toFixed(2)}%` : '--')
                        : ((top3[2] as { avgMAPE: number | null }).avgMAPE !== null ? `${((top3[2] as { avgMAPE: number | null }).avgMAPE! * 100).toFixed(2)}%` : '--')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex space-x-2 border-b border-border">
            {[
              { key: 'final', label: 'Final Score', activeClass: 'border-accent text-accent' },
              { key: 'occupancy', label: 'Occupancy', activeClass: 'border-primary text-primary' },
              { key: 'adr', label: 'ADR', activeClass: 'border-success text-success' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'final' | 'occupancy' | 'adr')}
                className={`border-b-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key ? tab.activeClass : 'border-transparent text-text-muted hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
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
                        {activeTab === 'final' ? 'Final Score' : activeTab === 'occupancy' ? 'Occupancy MAPE' : 'ADR MAPE'}
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
    </div>
  )
}
