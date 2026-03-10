import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Send, Trophy, AlertTriangle, Clock, CheckCircle, ArrowRight, Calendar, Target, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CountdownTimer } from '@/components/countdown-timer'
import { AdminCommandCenter } from '@/components/admin/AdminCommandCenter'

export default async function DashboardPage() {
  const user = await getSession()
  if (!user) return null

  const activeSeason = await prisma.season.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      rounds: { orderBy: { number: 'asc' } },
      markets: { where: { isActive: true }, include: { market: true } },
    },
  })

  const currentRound = activeSeason?.rounds.find(
    (r) => {
      const now = new Date()
      const isTimeOpen = new Date(r.closesAt) > now && new Date(r.opensAt) <= now
      const hasStatus = 'status' in r
      const isStatusOpen = !hasStatus || r.status === 'OPEN'
      return isTimeOpen && isStatusOpen
    }
  )

  const stats = {
    totalTeams: await prisma.team.count({ where: { status: 'ACTIVE' } }),
    totalSubmissions: currentRound
      ? await prisma.submission.count({ where: { roundId: currentRound.id } })
      : 0,
    totalWarnings: await prisma.warning.count(),
  }

  if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') {
    return <AdminCommandCenter />
  }

  if (user.role === 'SUPERVISOR') {
    const supervisorTeams = await prisma.team.findMany({
      where: { supervisorId: user.id },
      include: {
        members: { include: { user: true } },
        _count: { select: { submissions: true, warnings: true } },
      },
    })

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Supervisor Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your teams and monitor submissions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/30 dark:to-gray-900 border-blue-100 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">My Teams</CardTitle>
              <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">{supervisorTeams.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">of 10 max</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/30 dark:to-gray-900 border-emerald-100 dark:border-emerald-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Students</CardTitle>
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {supervisorTeams.reduce((sum, t) => sum + t.members.length, 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/30 dark:to-gray-900 border-amber-100 dark:border-amber-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Warnings</CardTitle>
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {supervisorTeams.reduce((sum, t) => sum + t._count.warnings, 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>My Teams</CardTitle>
                <CardDescription>Teams you supervise</CardDescription>
              </div>
              <Link href="/teams/new">
                <Button>Create Team</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {supervisorTeams.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                You haven&apos;t created any teams yet. Create your first team to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {supervisorTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{team.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {team.members.length} members | {team._count.submissions} submissions
                      </p>
                    </div>
                    <Link href={`/teams/${team.id}`}>
                      <Button variant="outline" size="sm">
                        Manage
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const studentTeam = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    include: {
      team: {
        include: {
          members: { include: { user: true } },
          submissions: { 
            orderBy: { submittedAt: 'desc' }, 
            take: 5,
            include: { round: true, values: true }
          },
          warnings: { include: { round: true } },
        },
      },
    },
  })

  const hasSubmittedThisRound = currentRound && studentTeam
    ? await prisma.submission.count({
        where: { teamId: studentTeam.teamId, roundId: currentRound.id },
      }) > 0
    : false

  const rulesAcknowledged = await prisma.user.findUnique({
    where: { id: user.id },
    select: { rulesAcknowledgedAt: true },
  })

  return (
    <div className="space-y-8">
      {!rulesAcknowledged?.rulesAcknowledgedAt && (
        <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-900">Please acknowledge the competition rules</p>
                  <p className="text-sm text-amber-700">Read and accept the rules to participate in the competition.</p>
                </div>
              </div>
              <Link href="/rules">
                <Button variant="outline" className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40">
                  View Rules
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Welcome back, {user.firstName}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {studentTeam ? `Team: ${studentTeam.team.name}` : 'Not assigned to a team yet'}
          </p>
        </div>
        {activeSeason && (
          <div className="hidden md:flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            <span>{activeSeason.name}</span>
          </div>
        )}
      </div>

      {currentRound && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-5 w-5" />
                  <span className="text-blue-100 text-sm font-medium uppercase tracking-wide">
                    Current Round
                  </span>
                </div>
                <h2 className="text-3xl font-bold">Round {currentRound.number}</h2>
                <p className="text-blue-100 mt-1">
                  Deadline: {new Date(currentRound.closesAt).toLocaleString('en-US', { 
                    timeZone: 'America/New_York',
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })} ET
                </p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm mb-2">Time Remaining</p>
                <CountdownTimer closesAt={currentRound.closesAt.toISOString()} />
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            {hasSubmittedThisRound ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-700">Submitted</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Your forecast is locked</p>
                  </div>
                </div>
                <Link href="/scores">
                  <Button variant="outline">View Submission</Button>
                </Link>
              </div>
            ) : studentTeam?.isSubmitter ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">Ready to submit your forecast?</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">You need to submit 12 predictions (3 markets x 2 weeks x 2 metrics)</p>
                </div>
                <Link href="/submit">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    Submit Forecast
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">Your team&apos;s submitter will submit the forecast.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Team Status</CardTitle>
            <div className={`p-2 rounded-lg ${studentTeam?.team.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
              <Users className={`h-5 w-5 ${studentTeam?.team.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-bold ${studentTeam?.team.status === 'ACTIVE' ? 'text-green-600' : 'text-red-600'}`}>
              {studentTeam ? studentTeam.team.status : 'Not Assigned'}
            </p>
            {studentTeam && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{studentTeam.team.members.length} members</p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Submissions</CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <Send className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              {studentTeam?.team.submissions.length || 0}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">total forecasts</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Warnings</CardTitle>
            <div className={`p-2 rounded-lg ${(studentTeam?.team.warnings.length || 0) >= 2 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}`}>
              <AlertTriangle className={`h-5 w-5 ${(studentTeam?.team.warnings.length || 0) >= 2 ? 'text-red-600' : 'text-amber-600'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-1">
              <p className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                {studentTeam?.team.warnings.length || 0}
              </p>
              <p className="text-lg text-gray-400">/ 3</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">before disqualification</p>
          </CardContent>
        </Card>
      </div>

      {!studentTeam && (
        <Card className="border-dashed border-2 dark:border-gray-700">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Not Assigned to a Team</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Your supervisor needs to add you to a team. Make sure they have your email address: <span className="font-medium">{user.email}</span>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/leaderboards" className="block">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <div className="flex items-center space-x-3">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <span className="font-medium">View Leaderboards</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
            <Link href="/scores" className="block">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <div className="flex items-center space-x-3">
                  <Send className="h-5 w-5 text-blue-500" />
                  <span className="font-medium">View My Scores</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
            <Link href="/rules" className="block">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-purple-500" />
                  <span className="font-medium">Competition Rules</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          </CardContent>
        </Card>

        {studentTeam && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span>Team Members</span>
              </CardTitle>
              <CardDescription>{studentTeam.team.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {studentTeam.team.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {member.user.firstName[0]}{member.user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{member.user.email}</p>
                      </div>
                    </div>
                    {member.isSubmitter && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                        Submitter
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {studentTeam && studentTeam.team.submissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {studentTeam.team.submissions.slice(0, 5).map((sub) => {
                const occValues = sub.values.filter(v => v.metric === 'OCCUPANCY')
                const adrValues = sub.values.filter(v => v.metric === 'ADR')
                const avgOcc = occValues.length > 0 ? occValues.reduce((sum, v) => sum + v.value, 0) / occValues.length : 0
                const avgAdr = adrValues.length > 0 ? adrValues.reduce((sum, v) => sum + v.value, 0) / adrValues.length : 0
                return (
                  <div key={sub.id} className="flex items-center space-x-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-full">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        Round {sub.round.number} {sub.round.isFinal ? '(Final)' : ''}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Submitted {new Date(sub.submittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-600 dark:text-gray-400">{avgOcc.toFixed(1)} | ${avgAdr.toFixed(0)}</p>
                      <p className="text-xs text-gray-400">{sub.values.length} predictions</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
