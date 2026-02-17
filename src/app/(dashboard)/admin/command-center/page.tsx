'use client'

import { csrfFetch } from '@/lib/csrf'

import { clientLogger } from '@/lib/client-logger'


import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CardSkeleton } from '@/components/ui/skeleton'
import { 
  Play, 
  Users, 
  Send, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Upload,
  Calculator,
  Trophy,
  Bell,
  Settings,
  FileText,
  Shield,
  RefreshCw,
  Zap
} from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  activeSeason: {
    id: string
    name: string
    status: string
  } | null
  currentRound: {
    id: string
    number: number
    opensAt: string
    closesAt: string
    status: string
  } | null
  stats: {
    totalTeams: number
    activeTeams: number
    disqualifiedTeams: number
    totalUsers: number
    totalSubmissions: number
    currentRoundSubmissions: number
    totalWarnings: number
    teamsWithActuals: number
    scoredSubmissions: number
  }
  submissionProgress: {
    submitted: number
    pending: number
    total: number
  }
  rounds: Array<{
    id: string
    number: number
    opensAt: string
    closesAt: string
    status: string
    submissionCount: number
    hasActuals: boolean
    isScored: boolean
  }>
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'Open': 'bg-green-100 text-green-700 border-green-200',
    'Closing Soon': 'bg-amber-100 text-amber-700 border-amber-200',
    'Closed': 'bg-gray-100 text-gray-700 border-gray-200',
    'Upcoming': 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colors[status] || colors['Upcoming']}`}>
      {status}
    </span>
  )
}

function QuickActionCard({ 
  icon: Icon, 
  title, 
  description, 
  href, 
  variant = 'default',
  onClick,
  loading
}: { 
  icon: React.ElementType
  title: string
  description: string
  href?: string
  variant?: 'default' | 'primary' | 'warning' | 'success'
  onClick?: () => void
  loading?: boolean
}) {
  const variantStyles = {
    default: 'bg-white hover:bg-gray-50 border-gray-200',
    primary: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
    warning: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
    success: 'bg-green-50 hover:bg-green-100 border-green-200',
  }

  const iconStyles = {
    default: 'bg-gray-100 text-gray-600',
    primary: 'bg-blue-100 text-blue-600',
    warning: 'bg-amber-100 text-amber-600',
    success: 'bg-green-100 text-green-600',
  }

  const content = (
    <div className={`p-4 rounded-xl border transition-all cursor-pointer ${variantStyles[variant]} ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="flex items-start space-x-4">
        <div className={`p-2.5 rounded-lg ${iconStyles[variant]}`}>
          {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )

  if (onClick) {
    return <button onClick={onClick} className="w-full text-left">{content}</button>
  }

  return href ? <Link href={href}>{content}</Link> : content
}

export default function AdminCommandCenterPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await csrfFetch('/api/admin/command-center')
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (error) {
      clientLogger.error('Failed to fetch command center data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAction = async (action: string, endpoint: string) => {
    setActionLoading(action)
    try {
      const res = await csrfFetch(endpoint, { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        alert(result.message || 'Action completed successfully')
        fetchData()
      } else {
        alert(result.message || 'Action failed')
      }
    } catch (error) {
      clientLogger.error('Action failed:', error)
      alert('An error occurred')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load command center data</p>
        <Button onClick={fetchData} className="mt-4">Retry</Button>
      </div>
    )
  }

  const submissionPercent = data.submissionProgress.total > 0 
    ? Math.round((data.submissionProgress.submitted / data.submissionProgress.total) * 100) 
    : 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 mt-1">
            {data.activeSeason ? `${data.activeSeason.name} - ${data.activeSeason.status}` : 'No active season'}
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="h-4 w-4 mr-2 text-blue-600" />
              Active Teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{data.stats.activeTeams}</p>
            {data.stats.disqualifiedTeams > 0 && (
              <p className="text-xs text-gray-500">{data.stats.disqualifiedTeams} disqualified</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Send className="h-4 w-4 mr-2 text-emerald-600" />
              This Round
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600">{data.submissionProgress.submitted}</p>
            <p className="text-xs text-gray-500">of {data.submissionProgress.total} teams</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{data.stats.totalWarnings}</p>
            <p className="text-xs text-gray-500">total issued</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="h-4 w-4 mr-2 text-purple-600" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">{data.stats.totalUsers}</p>
            <p className="text-xs text-gray-500">registered</p>
          </CardContent>
        </Card>
      </div>

      {data.currentRound && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Play className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-indigo-100 text-sm font-medium">Current Round</p>
                    <h2 className="text-2xl font-bold">Round {data.currentRound.number}</h2>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={data.currentRound.status} />
                <p className="text-indigo-100 text-sm mt-2">
                  Closes: {new Date(data.currentRound.closesAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  })}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-indigo-100">Submission Progress</span>
                <span className="font-semibold">{submissionPercent}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div 
                  className="bg-white h-3 rounded-full transition-all duration-500"
                  style={{ width: `${submissionPercent}%` }}
                />
              </div>
              <p className="text-indigo-100 text-sm mt-2">
                {data.submissionProgress.submitted} of {data.submissionProgress.total} teams have submitted
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-5 w-5 mr-2 text-amber-500" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common admin operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickActionCard
              icon={Bell}
              title="Send Round Reminders"
              description="Email teams who haven't submitted yet"
              variant="primary"
              onClick={() => handleAction('reminder', '/api/admin/notifications/round-reminder')}
              loading={actionLoading === 'reminder'}
            />
            <QuickActionCard
              icon={AlertTriangle}
              title="Process Missed Submissions"
              description="Issue warnings for teams who missed the deadline"
              variant="warning"
              onClick={() => handleAction('missed', '/api/admin/notifications/missed-submissions')}
              loading={actionLoading === 'missed'}
            />
            <QuickActionCard
              icon={Calculator}
              title="Run Scoring"
              description="Calculate scores for submitted forecasts"
              href="/admin/scoring"
              variant="success"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="h-5 w-5 mr-2 text-gray-500" />
              Management
            </CardTitle>
            <CardDescription>Configure and manage competition</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickActionCard
              icon={Upload}
              title="Upload Actuals"
              description="Import actual values for scoring"
              href="/admin/actuals"
            />
            <QuickActionCard
              icon={Users}
              title="Manage Teams"
              description="View, edit, and disqualify teams"
              href="/admin/teams"
            />
            <QuickActionCard
              icon={Shield}
              title="Manage Users"
              description="User accounts and permissions"
              href="/admin/users"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-500" />
            All Rounds
          </CardTitle>
          <CardDescription>Season round status and progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.rounds.map((round) => (
              <div 
                key={round.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                  round.status === 'Open' ? 'bg-green-50 border-green-200' : 
                  round.status === 'Closing Soon' ? 'bg-amber-50 border-amber-200' : 
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className={`p-2 rounded-lg ${
                    round.status === 'Open' ? 'bg-green-100' : 
                    round.status === 'Closing Soon' ? 'bg-amber-100' : 
                    'bg-gray-100'
                  }`}>
                    <span className="font-bold text-lg">{round.number}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Round {round.number}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(round.opensAt).toLocaleDateString()} - {new Date(round.closesAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{round.submissionCount} submissions</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      {round.hasActuals && (
                        <span className="flex items-center text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Actuals
                        </span>
                      )}
                      {round.isScored && (
                        <span className="flex items-center text-blue-600">
                          <Trophy className="h-3 w-3 mr-1" />
                          Scored
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={round.status} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <QuickActionCard
          icon={FileText}
          title="Submissions Explorer"
          description="Browse and export all submissions"
          href="/admin/submissions"
        />
        <QuickActionCard
          icon={Trophy}
          title="Leaderboards"
          description="View and publish rankings"
          href="/leaderboards"
        />
        <QuickActionCard
          icon={FileText}
          title="Audit Logs"
          description="View admin action history"
          href="/admin/audit-logs"
        />
      </div>
    </div>
  )
}

