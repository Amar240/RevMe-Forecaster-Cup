'use client'

import { clientLogger } from '@/lib/client-logger'
import { getCurrentSession } from '@/features/auth/api'
import { getLeaderboard } from '@/features/leaderboards/api'
import type { LeaderboardEntry, RoundInfo } from '@/features/leaderboards/types'
import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
  const [userRole, setUserRole] = useState<string>('')

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

      const sessionData = await getCurrentSession()
      setUserRole(sessionData?.user.role || '')
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
  const canSeeAllMAPE = userRole === 'ADMIN' || userRole === 'SUB_ADMIN' || userRole === 'SUPERVISOR'

  const scoredRounds = rounds.filter((r) => {
    const hasScores = currentLeaderboard.some((entry) => entry.cumulativeScores[r.id] !== undefined)
    return hasScores
  })

  const sortedRoundIds = useMemo(() => {
    return rounds.sort((a, b) => a.number - b.number).map(r => r.id)
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
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />
    return null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const universityLeaderboard = getUniversityLeaderboard()
  const top3 = viewMode === 'team' ? currentLeaderboard.slice(0, 3) : universityLeaderboard.slice(0, 3)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Leaderboards</h1>
          <p className="text-gray-500 dark:text-gray-400">{seasonName || 'No active season'} rankings</p>
        </div>
        <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('team')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'team' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Teams</span>
          </button>
          <button
            onClick={() => setViewMode('university')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'university' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Scores Yet</h3>
            <p className="text-gray-500">Leaderboards will appear after scores are calculated.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {top3.length >= 3 && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="order-1 md:order-2 col-span-3 md:col-span-1 bg-gradient-to-b from-yellow-50 to-white border-yellow-200">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Trophy className="h-10 w-10 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {viewMode === 'team' ? (top3[0] as LeaderboardEntry).teamName : (top3[0] as { university: string }).university}
                  </p>
                  {viewMode === 'team' && (
                    <p className="text-sm text-gray-500 mb-3">{(top3[0] as LeaderboardEntry).university}</p>
                  )}
                  <div className="inline-flex items-center space-x-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">
                    <span>1st Place</span>
                  </div>
                  {canSeeAllMAPE && (
                    <p className="mt-3 text-2xl font-bold text-amber-600">
                      {viewMode === 'team'
                        ? ((top3[0] as LeaderboardEntry).mape !== null ? `${((top3[0] as LeaderboardEntry).mape! * 100).toFixed(2)}%` : '--')
                        : ((top3[0] as { avgMAPE: number | null }).avgMAPE !== null ? `${((top3[0] as { avgMAPE: number | null }).avgMAPE! * 100).toFixed(2)}%` : '--')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="order-2 md:order-1 col-span-3 md:col-span-1 bg-gradient-to-b from-gray-50 to-white border-gray-200">
                <CardContent className="pt-6 pb-4 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center mx-auto mb-3 shadow">
                    <Medal className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-lg font-bold text-gray-900 mb-1">
                    {viewMode === 'team' ? (top3[1] as LeaderboardEntry).teamName : (top3[1] as { university: string }).university}
                  </p>
                  {viewMode === 'team' && (
                    <p className="text-sm text-gray-500 mb-2">{(top3[1] as LeaderboardEntry).university}</p>
                  )}
                  <div className="inline-flex items-center space-x-1 bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                    <span>2nd Place</span>
                  </div>
                  {canSeeAllMAPE && (
                    <p className="mt-2 text-xl font-bold text-gray-600">
                      {viewMode === 'team'
                        ? ((top3[1] as LeaderboardEntry).mape !== null ? `${((top3[1] as LeaderboardEntry).mape! * 100).toFixed(2)}%` : '--')
                        : ((top3[1] as { avgMAPE: number | null }).avgMAPE !== null ? `${((top3[1] as { avgMAPE: number | null }).avgMAPE! * 100).toFixed(2)}%` : '--')}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="order-3 col-span-3 md:col-span-1 bg-gradient-to-b from-orange-50 to-white border-orange-200">
                <CardContent className="pt-6 pb-4 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow">
                    <Medal className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-lg font-bold text-gray-900 mb-1">
                    {viewMode === 'team' ? (top3[2] as LeaderboardEntry).teamName : (top3[2] as { university: string }).university}
                  </p>
                  {viewMode === 'team' && (
                    <p className="text-sm text-gray-500 mb-2">{(top3[2] as LeaderboardEntry).university}</p>
                  )}
                  <div className="inline-flex items-center space-x-1 bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-medium">
                    <span>3rd Place</span>
                  </div>
                  {canSeeAllMAPE && (
                    <p className="mt-2 text-xl font-bold text-orange-600">
                      {viewMode === 'team'
                        ? ((top3[2] as LeaderboardEntry).mape !== null ? `${((top3[2] as LeaderboardEntry).mape! * 100).toFixed(2)}%` : '--')
                        : ((top3[2] as { avgMAPE: number | null }).avgMAPE !== null ? `${((top3[2] as { avgMAPE: number | null }).avgMAPE! * 100).toFixed(2)}%` : '--')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex space-x-2 border-b">
            {[
              { key: 'final', label: 'Final Score', color: 'amber' },
              { key: 'occupancy', label: 'Occupancy', color: 'blue' },
              { key: 'adr', label: 'ADR', color: 'emerald' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'final' | 'occupancy' | 'adr')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors`}
                style={{
                  borderColor: activeTab === tab.key
                    ? tab.color === 'amber' ? '#d97706' : tab.color === 'blue' ? '#2563eb' : '#059669'
                    : 'transparent',
                  color: activeTab === tab.key
                    ? tab.color === 'amber' ? '#d97706' : tab.color === 'blue' ? '#2563eb' : '#059669'
                    : undefined,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {canSeeAllMAPE && scoredRounds.length > 0 && viewMode === 'team' && activeTab !== 'final' && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowProgression(!showProgression)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  showProgression 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {showProgression ? 'Hide' : 'Show'} Round Progression
              </button>
            </div>
          )}

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {viewMode === 'team' ? 'Team' : 'University'}
                    </th>
                    {viewMode === 'team' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">University</th>
                    )}
          {canSeeAllMAPE && showProgression && viewMode === 'team' && activeTab !== 'final' && scoredRounds.map((round) => (
                      <th key={round.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        R{round.number}
                      </th>
                    ))}
                    {canSeeAllMAPE && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {activeTab === 'final' ? 'Final Score' : activeTab === 'occupancy' ? 'Occupancy MAPE' : 'ADR MAPE'}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {viewMode === 'team'
                    ? currentLeaderboard.map((entry) => (
                        <tr
                          key={entry.teamId}
                          className={entry.teamId === myTeamId ? 'bg-blue-50' : 'hover:bg-gray-50'}
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
                              <span className="font-medium text-gray-900">{entry.teamName}</span>
                              {entry.teamId === myTeamId && (
                                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">You</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-500">{entry.university}</td>
                          {canSeeAllMAPE && showProgression && activeTab !== 'final' && scoredRounds.map((round) => (
                            <td key={round.id} className="px-3 py-4 whitespace-nowrap text-center font-mono text-sm">
                              {entry.cumulativeScores[round.id] !== undefined 
                                ? `${(entry.cumulativeScores[round.id] * 100).toFixed(2)}%`
                                : '--'}
                            </td>
                          ))}
                          {canSeeAllMAPE && (
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
                        <tr key={entry.university} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              {getRankIcon(entry.rank)}
                              <span className={`font-bold ${entry.rank <= 3 ? 'text-lg' : ''}`}>
                                #{entry.rank}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-gray-900">{entry.university}</span>
                            <span className="ml-2 text-gray-500 text-sm">({entry.teamCount} teams)</span>
                          </td>
                          {canSeeAllMAPE && (
                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono">
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

