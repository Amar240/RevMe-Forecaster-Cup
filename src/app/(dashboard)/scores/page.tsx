'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, CheckCircle, AlertCircle, TrendingDown, BarChart3, Filter, ChevronDown, ChevronUp, Download, TrendingUp, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/skeleton'

const ScoreTrendChart = dynamic(
  () => import('@/components/charts/ScoreTrendChart').then((mod) => mod.ScoreTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] w-full rounded-lg bg-gray-50 dark:bg-gray-800 animate-pulse" />
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
  round: { number: number }
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

export default function ScoresPage() {
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<Team | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [trends, setTrends] = useState<TrendData[]>([])
  const [expandedRounds, setExpandedRounds] = useState<number[]>([])
  const [filterMarket, setFilterMarket] = useState<string>('all')

  useEffect(() => {
    fetchScores()
  }, [])

  const fetchScores = async () => {
    try {
      const [userRes, subRes, trendRes] = await Promise.all([
        csrfFetch('/api/users/me'),
        csrfFetch('/api/submissions/history'),
        csrfFetch('/api/scores/trends'),
      ])

      if (userRes.ok) {
        const userData = await userRes.json()
        const teamMembership = userData.user?.teamMemberships?.[0]
        if (teamMembership) {
          setTeam(teamMembership.team)
        }
      }

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
    } catch (error) {
      clientLogger.error('Failed to fetch scores:', error)
      toast.error('Failed to load scores')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const res = await csrfFetch('/api/submissions/export')
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
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
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
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Not on a Team</h3>
            <p className="text-gray-500 dark:text-gray-400">You need to be added to a team to view scores.</p>
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Scores</h1>
          <p className="text-gray-500 dark:text-gray-400">Team: {team.name}</p>
        </div>
        <Button variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-gray-50 to-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Submissions</CardTitle>
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gray-900">{submissions.length}</p>
            <p className="text-sm text-gray-500">{scoredCount} scored</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Final Score</CardTitle>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
              <Trophy className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-amber-600">
              {scoredCount > 0
                ? ((((totalOccupancyAPE / scoredCount) + (totalAdrAPE / scoredCount)) / 2) * 100).toFixed(2) + '%'
                : '-'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">(Occupancy MAPE + ADR MAPE) / 2</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border-blue-100 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Occupancy MAPE</CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <TrendingDown className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-blue-600">
              {scoredCount > 0 ? `${((totalOccupancyAPE / scoredCount) * 100).toFixed(2)}%` : '-'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">lower is better</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900 border-emerald-100 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">ADR MAPE</CardTitle>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-emerald-600">
              {scoredCount > 0 ? ((totalAdrAPE / scoredCount) * 100).toFixed(2) + '%' : '-'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">lower is better</p>
          </CardContent>
        </Card>
      </div>

      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span>Score Trends</span>
            </CardTitle>
            <CardDescription>Your MAPE scores across rounds (lower is better)</CardDescription>
          </CardHeader>
          <CardContent>
            <ScoreTrendChart data={trends} height={280} />
          </CardContent>
        </Card>
      )}

      {markets.length > 1 && (
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500 dark:text-gray-400">Filter by market:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilterMarket('all')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filterMarket === 'all'
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/50'
              }`}
            >
              All
            </button>
            {markets.map((market) => (
              <button
                key={market}
                onClick={() => setFilterMarket(market)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  filterMarket === market
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/50'
                }`}
              >
                {market}
              </button>
            ))}
          </div>
        </div>
      )}

      {Object.keys(filteredSubmissionsByRound).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Submissions Yet</h3>
            <p className="text-gray-500 dark:text-gray-400">Your team hasn&apos;t submitted any forecasts yet.</p>
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
                    <CardHeader className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <CardTitle>Round {roundNum}</CardTitle>
                          {hasScores ? (
                            <span className="flex items-center text-sm text-green-600 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Scored
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                              Pending
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-6">
                          {hasScores && (
                            <div className="flex space-x-4 text-sm">
                              <span className="text-blue-600">
                                Occ: {roundOccMAPE !== null ? `${(roundOccMAPE * 100).toFixed(2)}%` : '--'}
                              </span>
                              <span className="text-emerald-600">
                                ADR: {roundAdrMAPE !== null ? `${(roundAdrMAPE * 100).toFixed(2)}%` : '--'}
                              </span>
                              {roundFinalMAPE !== null && (
                                <span className="text-amber-600">Final: {(roundFinalMAPE * 100).toFixed(2)}%</span>
                              )}
                            </div>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </button>
                  {isExpanded && (
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
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
                              <tr key={sub.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <td className="px-6 py-4 font-medium">{sub.market.name}</td>
                                <td className="px-6 py-4">
                                  <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400">
                                    +{sub.weekOffset}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">{sub.occupancy.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right">${sub.adr.toFixed(2)}</td>
                                {sub.score && (
                                  <>
                                    <td className="px-6 py-4 text-right text-blue-600 font-medium">
                                      {sub.score.occupancyAE.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right text-emerald-600 font-medium">
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
    </div>
  )
}

