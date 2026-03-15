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
          <h1 className="text-3xl font-semibold text-foreground">Supervisor Dashboard</h1>
          <p className="mt-1 text-text-secondary">Manage your teams and monitor submissions</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card variant="metric" className="border-primary/10 bg-gradient-to-br from-primary-soft via-card to-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">My Teams</CardTitle>
              <div className="rounded-lg bg-primary-soft p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-foreground">{supervisorTeams.length}</p>
              <p className="text-sm text-text-secondary">of 10 max</p>
            </CardContent>
          </Card>

          <Card variant="metric" className="border-success/15 bg-gradient-to-br from-success-background via-card to-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">Total Students</CardTitle>
              <div className="rounded-lg bg-success-background p-2">
                <Users className="h-5 w-5 text-success" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-foreground">
                {supervisorTeams.reduce((sum, t) => sum + t.members.length, 0)}
              </p>
            </CardContent>
          </Card>

          <Card variant="metric" className="border-warning/15 bg-gradient-to-br from-warning-background via-card to-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">Warnings</CardTitle>
              <div className="rounded-lg bg-warning-background p-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-semibold text-foreground">
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
              <p className="py-8 text-center text-text-secondary">
                You haven&apos;t created any teams yet. Create your first team to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {supervisorTeams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary p-4 transition-colors hover:bg-muted"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{team.name}</p>
                      <p className="text-sm text-text-secondary">
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
        <Card className="border-warning/20 bg-gradient-to-r from-warning-background via-card to-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="rounded-lg bg-warning-background p-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Please acknowledge the competition rules</p>
                  <p className="text-sm text-text-secondary">Read and accept the rules to participate in the competition.</p>
                </div>
              </div>
              <Link href="/rules">
                <Button variant="outline" className="border-warning/30 text-warning hover:bg-warning-background">
                  View Rules
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">
            Welcome back, {user.firstName}!
          </h1>
          <p className="mt-1 text-text-secondary">
            {studentTeam ? `Team: ${studentTeam.team.name}` : 'Not assigned to a team yet'}
          </p>
        </div>
        {activeSeason && (
          <div className="hidden items-center space-x-2 text-sm text-text-secondary md:flex">
            <Calendar className="h-4 w-4" />
            <span>{activeSeason.name}</span>
          </div>
        )}
      </div>

      {currentRound && (
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-primary-hover p-6 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <Target className="h-5 w-5" />
                  <span className="text-sm font-medium uppercase tracking-wide text-primary-foreground/80">
                    Current Round
                  </span>
                </div>
                <h2 className="text-3xl font-semibold">Round {currentRound.number}</h2>
                <p className="mt-1 text-primary-foreground/80">
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
                <p className="mb-2 text-sm text-primary-foreground/80">Time Remaining</p>
                <CountdownTimer closesAt={currentRound.closesAt.toISOString()} />
              </div>
            </div>
          </div>
          <CardContent className="px-6 py-5">
            {hasSubmittedThisRound ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="rounded-full bg-success-background p-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-success">Submitted</p>
                    <p className="text-sm text-text-secondary">Your forecast is locked</p>
                  </div>
                </div>
                <Link href="/scores">
                  <Button variant="outline">View Submission</Button>
                </Link>
              </div>
            ) : studentTeam?.isSubmitter ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-foreground">Ready to submit your forecast?</p>
                  <p className="text-sm text-text-secondary">You need to submit 12 predictions (3 markets x 2 weeks x 2 metrics)</p>
                </div>
                <Link href="/submit">
                  <Button size="lg" className="bg-primary hover:bg-primary-hover">
                    Submit Forecast
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <p className="text-text-secondary">Your team&apos;s submitter will submit the forecast.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Team Status</CardTitle>
            <div className={`rounded-lg p-2 ${studentTeam?.team.status === 'ACTIVE' ? 'bg-success-background' : 'bg-error-background'}`}>
              <Users className={`h-5 w-5 ${studentTeam?.team.status === 'ACTIVE' ? 'text-success' : 'text-error'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <p className={`text-lg font-semibold ${studentTeam?.team.status === 'ACTIVE' ? 'text-success' : 'text-error'}`}>
              {studentTeam ? studentTeam.team.status : 'Not Assigned'}
            </p>
            {studentTeam && (
              <p className="text-sm text-text-secondary">{studentTeam.team.members.length} members</p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Submissions</CardTitle>
            <div className="rounded-lg bg-primary-soft p-2">
              <Send className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold text-foreground">
              {studentTeam?.team.submissions.length || 0}
            </p>
            <p className="text-sm text-text-secondary">total forecasts</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Warnings</CardTitle>
            <div className={`rounded-lg p-2 ${(studentTeam?.team.warnings.length || 0) >= 2 ? 'bg-error-background' : 'bg-warning-background'}`}>
              <AlertTriangle className={`h-5 w-5 ${(studentTeam?.team.warnings.length || 0) >= 2 ? 'text-error' : 'text-warning'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-1">
              <p className="text-4xl font-semibold text-foreground">
                {studentTeam?.team.warnings.length || 0}
              </p>
              <p className="text-lg text-muted-foreground">/ 3</p>
            </div>
            <p className="text-sm text-text-secondary">before disqualification</p>
          </CardContent>
        </Card>
      </div>

      {!studentTeam && (
        <Card className="border-2 border-dashed border-border">
          <CardContent className="py-12 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-xl font-semibold text-foreground">Not Assigned to a Team</h3>
            <p className="mx-auto max-w-md text-text-secondary">
              Your supervisor needs to add you to a team. Make sure they have your email address: <span className="font-medium">{user.email}</span>
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Quick Actions</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/leaderboards" className="block">
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary p-4 transition-colors hover:bg-muted">
                <div className="flex items-center space-x-3">
                  <Trophy className="h-5 w-5 text-accent" />
                  <span className="font-medium">View Leaderboards</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/scores" className="block">
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary p-4 transition-colors hover:bg-muted">
                <div className="flex items-center space-x-3">
                  <Send className="h-5 w-5 text-primary" />
                  <span className="font-medium">View My Scores</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
            <Link href="/rules" className="block">
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-secondary p-4 transition-colors hover:bg-muted">
                <div className="flex items-center space-x-3">
                  <Target className="h-5 w-5 text-primary" />
                  <span className="font-medium">Competition Rules</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </CardContent>
        </Card>

        {studentTeam && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary" />
                <span>Team Members</span>
              </CardTitle>
              <CardDescription>{studentTeam.team.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {studentTeam.team.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary p-3">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                        {member.user.firstName[0]}{member.user.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {member.user.firstName} {member.user.lastName}
                        </p>
                        <p className="text-sm text-text-secondary">{member.user.email}</p>
                      </div>
                    </div>
                    {member.isSubmitter && (
                      <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
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
              <Clock className="h-5 w-5 text-primary" />
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
                    <div className="rounded-full bg-success-background p-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        Round {sub.round.number} {sub.round.isFinal ? '(Final)' : ''}
                      </p>
                      <p className="text-sm text-text-secondary">
                        Submitted {new Date(sub.submittedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-text-secondary">{avgOcc.toFixed(1)} | ${avgAdr.toFixed(0)}</p>
                      <p className="text-xs text-muted-foreground">{sub.values.length} predictions</p>
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
