import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Send, Trophy, AlertTriangle, Clock, CheckCircle, ArrowRight, Calendar, Target, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CountdownTimer } from '@/components/countdown-timer'
import { AdminCommandCenter } from '@/components/admin/AdminCommandCenter'
import { getCurrentOperationalSeason } from '@/server/season'
import { competitionRanks, formatMape } from '@/lib/learning-analytics'
import { StatCard } from '@/components/ui/stat-card'
import { DualTimezoneDeadline } from '@/components/dual-timezone-deadline'
import { MotionReveal } from '@/components/ui/motion-reveal'
import { getSupervisorCoaching } from '@/server/supervisor-coaching'
import { predictionsBreakdownLabel } from '@/lib/competition-config'

export default async function DashboardPage() {
  const user = await getSession()
  if (!user) return null

  const operationalSeason = await getCurrentOperationalSeason({
    include: {
      rounds: { orderBy: { number: 'asc' } },
      markets: { where: { isActive: true }, include: { market: true } },
    },
  })

  const currentRound = operationalSeason?.rounds.find(
    (r) => {
      const now = new Date()
      const isTimeOpen = new Date(r.closesAt) > now && new Date(r.opensAt) <= now
      const hasStatus = 'status' in r
      const isStatusOpen = !hasStatus || r.status === 'OPEN'
      return isTimeOpen && isStatusOpen
    }
  )

  const stats = {
    totalTeams: operationalSeason
      ? await prisma.team.count({ where: { status: 'ACTIVE', seasonId: operationalSeason.id } })
      : 0,
    totalSubmissions: currentRound
      ? await prisma.submission.count({ where: { roundId: currentRound.id } })
      : 0,
    totalWarnings: await prisma.warning.count(),
  }

  if (user.role === 'ADMIN' || user.role === 'SUB_ADMIN') {
    return <AdminCommandCenter />
  }

  if (user.role === 'SUPERVISOR') {
    const coaching = await getSupervisorCoaching(user.id)
    const supervisorTeams = operationalSeason
      ? await prisma.team.findMany({
          where: { supervisorId: user.id, seasonId: operationalSeason.id },
          include: {
            members: { include: { user: true } },
            _count: { select: { submissions: true, warnings: true } },
          },
        })
      : []

    return (
      <MotionReveal className="space-y-8">
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>My Teams</CardTitle>
                <CardDescription>Teams you supervise</CardDescription>
              </div>
              {operationalSeason ? (
                <Link href="/teams/new">
                  <Button>Create Team</Button>
                </Link>
              ) : (
                <Button disabled>Create Team</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {supervisorTeams.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-text-secondary">
                  {operationalSeason
                    ? 'You haven\'t created any teams yet. Create your first team to get started.'
                    : 'An admin needs to create, activate, or resume a season before you can create teams.'}
                </p>
                {operationalSeason && (
                  <div className="mt-4">
                    <Link href="/teams/new">
                      <Button>Create Team</Button>
                    </Link>
                  </div>
                )}
              </div>
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
        {coaching?.round && <><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Team health · Round {coaching.round.number}</CardTitle><CardDescription>Submission, time remaining, score trend, bias, and warnings for your teams</CardDescription></div>{coaching.round.leaderboardVisible && <Link href={`/supervisor/debriefs/${coaching.round.id}`}><Button variant="outline">Project round debrief</Button></Link>}</div></CardHeader><CardContent><div className="hidden overflow-x-auto lg:block"><table className="w-full text-sm"><caption className="sr-only">Supervisor team health for round {coaching.round.number}</caption><thead><tr className="border-b text-left text-text-muted"><th className="py-3">Team</th><th>Members</th><th>Submitted</th><th>Hours left</th><th>MAPE</th><th>Trend</th><th>Pattern</th><th>Warnings</th></tr></thead><tbody>{coaching.teams.map((team) => <tr key={team.id} className="border-b border-border"><td className="py-3 font-medium">{team.name}</td><td className="max-w-48 text-xs text-text-secondary">{team.members.join(', ') || '—'}</td><td>{team.submitted ? '✓ Submitted' : '○ Pending'}</td><td className="tabular-nums">{team.submitted ? '—' : team.hoursRemaining.toFixed(1)}</td><td className="font-mono tabular-nums">{formatMape(team.score)}</td><td>{team.trend == null ? '—' : team.trend > 0 ? '▲ Improving' : team.trend < 0 ? '▼ Worsening' : '— Steady'}</td><td>{team.bias ? `${team.bias.direction === 'OVER' ? '↑' : '↓'} ${team.bias.marketName} ${team.bias.metric === 'ADR' ? 'ADR' : 'Occ'}` : '—'}</td><td className="tabular-nums">{team.warnings}</td></tr>)}</tbody></table></div><div className="space-y-3 lg:hidden">{coaching.teams.map((team) => <div key={team.id} className="rounded-xl border border-border p-4"><div className="flex justify-between"><strong>{team.name}</strong><span>{team.submitted ? '✓ Submitted' : '○ Pending'}</span></div><p className="mt-1 text-xs text-text-muted">{team.members.join(', ') || 'No members'}</p><p className="mt-2 text-sm text-text-secondary">{team.submitted ? 'Forecast locked' : `${team.hoursRemaining.toFixed(1)} hours remaining`} · MAPE {formatMape(team.score)} · {team.warnings} warnings</p>{team.bias && <p className="text-sm">Pattern: {team.bias.direction.toLowerCase()} {team.bias.marketName} {team.bias.metric}</p>}</div>)}</div></CardContent></Card>{coaching.insights?.common && <Card className="border-accent/30"><CardHeader><CardTitle>Class insight</CardTitle></CardHeader><CardContent><p>{coaching.insights.common.teamCount} of {coaching.insights.common.totalTeams} teams {coaching.insights.common.direction.toLowerCase()}-forecast {coaching.insights.common.marketName} {coaching.insights.common.metric === 'ADR' ? 'ADR' : 'occupancy'}.</p>{coaching.insights.bestCall && <p className="mt-2 text-sm text-text-secondary">Best call: {coaching.insights.bestCall.teamName} · {coaching.insights.bestCall.marketName} {coaching.insights.bestCall.metric} · {formatMape(coaching.insights.bestCall.apeError)}</p>}</CardContent></Card>}</>}
      </MotionReveal>
    )
  }

  const studentTeam = operationalSeason
    ? await prisma.teamMember.findFirst({
        where: { userId: user.id, team: { seasonId: operationalSeason.id } },
        include: {
          team: {
            include: {
              members: { include: { user: true } },
              submissions: {
                where: { round: { seasonId: operationalSeason.id } },
                orderBy: { submittedAt: 'desc' },
                take: 5,
                include: { round: true, values: true },
              },
              warnings: { include: { round: true } },
            },
          },
        },
      })
    : null

  const hasSubmittedThisRound = currentRound && studentTeam
    ? await prisma.submission.count({
        where: { teamId: studentTeam.teamId, roundId: currentRound.id },
      }) > 0
    : false

  const rulesAcknowledged = await prisma.user.findUnique({
    where: { id: user.id },
    select: { rulesAcknowledgedAt: true },
  })

  let publishedPosition: { score: number; rank: number; percentile: number; latestRoundId: string | null } | null = null
  if (studentTeam && operationalSeason) {
    const visibleRounds = operationalSeason.rounds.filter((round) => round.leaderboardVisible)
    const aggregates = visibleRounds.length ? await prisma.scoreAggregate.findMany({ where: { seasonId: operationalSeason.id, scopeType: 'ROUND', roundId: { in: visibleRounds.map((round) => round.id) }, team: { status: { in: ['ACTIVE', 'APPROVED'] } } }, select: { teamId: true, metric: true, mape: true, nErrors: true } }) : []
    const buckets = new Map<string, { occSum: number; occN: number; adrSum: number; adrN: number }>()
    for (const aggregate of aggregates) { const bucket = buckets.get(aggregate.teamId) || { occSum: 0, occN: 0, adrSum: 0, adrN: 0 }; if (aggregate.metric === 'OCCUPANCY') { bucket.occSum += aggregate.mape * aggregate.nErrors; bucket.occN += aggregate.nErrors } else { bucket.adrSum += aggregate.mape * aggregate.nErrors; bucket.adrN += aggregate.nErrors }; buckets.set(aggregate.teamId, bucket) }
    const ranked = competitionRanks(Array.from(buckets.entries()).flatMap(([teamId, bucket]) => bucket.occN && bucket.adrN ? [{ teamId, score: ((bucket.occSum / bucket.occN) + (bucket.adrSum / bucket.adrN)) / 2 }] : []))
    const mine = ranked.find((entry) => entry.teamId === studentTeam.teamId)
    if (mine) publishedPosition = { ...mine, latestRoundId: visibleRounds.at(-1)?.id || null }
  }

  return (
    <MotionReveal className="space-y-8">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Welcome back, {user.firstName}!
          </h1>
          <p className="mt-1 text-text-secondary">
            {studentTeam ? `Team: ${studentTeam.team.name}` : 'Not assigned to a team yet'}
          </p>
        </div>
        {operationalSeason && (
          <div className="hidden items-center space-x-2 text-sm text-text-secondary md:flex">
            <Calendar className="h-4 w-4" />
            <span>{operationalSeason.name}</span>
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
                  Deadline: <DualTimezoneDeadline date={currentRound.closesAt.toISOString()} />
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
                  <p className="text-sm text-text-secondary">You need to submit {predictionsBreakdownLabel(operationalSeason?.markets.length ?? 0, currentRound.isFinal)}</p>
                </div>
                <div className="flex flex-col items-end gap-2"><Link href="/submit">
                  <Button size="lg" className="bg-primary hover:bg-primary-hover">
                    Submit Forecast
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>{currentRound.number === 1 && <Link href="/rules#first-forecast" className="text-xs text-primary">First time? Read the 5-minute guide →</Link>}</div>
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

      {studentTeam && <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {publishedPosition ? <><StatCard title="Published score" value={formatMape(publishedPosition.score)} description="Combined MAPE · lower is better" icon={<Target className="h-5 w-5 text-primary" />} /><StatCard title="Current rank" value={`#${publishedPosition.rank}`} description={`${publishedPosition.percentile}th percentile`} icon={<Trophy className="h-5 w-5 text-accent" />} /><Card><CardContent className="flex h-full items-center justify-between py-6"><div><p className="font-semibold">Your latest debrief is ready</p><p className="text-sm text-text-secondary">Turn your result into the next forecast.</p></div>{publishedPosition.latestRoundId && <Link href={`/debrief/${publishedPosition.latestRoundId}`}><Button variant="outline">Open debrief</Button></Link>}</CardContent></Card></> : <Card className="md:col-span-3"><CardContent className="py-6"><p className="font-semibold">Scores have not been published yet</p><p className="text-sm text-text-secondary">Your rank, score, and debrief will appear here after the leaderboard is released.</p></CardContent></Card>}
      </div>}

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
            <h3 className="mb-2 text-xl font-semibold text-foreground">
              {operationalSeason ? 'Not Assigned to a Team' : 'No Operational Season Yet'}
            </h3>
            <p className="mx-auto max-w-md text-text-secondary">
              {operationalSeason ? (
                <>
                  Your supervisor needs to add you to a team. Make sure they have your email address:{' '}
                  <span className="font-medium">{user.email}</span>
                </>
              ) : (
                'An admin needs to activate or resume a season before teams and submissions open.'
              )}
            </p>
            {operationalSeason && (
              <div className="mt-4">
                <Link href="/join-team">
                  <Button>Find a Team</Button>
                </Link>
              </div>
            )}
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
                const valuesByMarket = new Map<string, typeof sub.values>()
                for (const value of sub.values) valuesByMarket.set(value.marketId, [...(valuesByMarket.get(value.marketId) || []), value])
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
                    <div className="flex flex-wrap justify-end gap-1 text-right text-xs">
                      {Array.from(valuesByMarket.entries()).map(([marketId, values]) => <span key={marketId} className="rounded-full bg-surface-secondary px-2 py-1 text-text-secondary">{operationalSeason?.markets.find((item) => item.market.id === marketId)?.market.name || 'Market'}: {values.length} values</span>)}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </MotionReveal>
  )
}
