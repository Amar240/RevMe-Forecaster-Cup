import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BookOpen, ChevronRight } from 'lucide-react'
import { getSession } from '@/lib/auth'
import { prisma } from '@/server/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function DebriefIndexPage({ searchParams }: { searchParams: Promise<{ teamId?: string }> }) {
  const user = await getSession()
  if (!user) redirect('/login')
  const { teamId: requestedTeamId } = await searchParams
  const season = await prisma.season.findFirst({ where: { status: { in: ['ACTIVE', 'COMPLETED'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true } })
  if (!season) return <Empty title="No season available" copy="Debriefs appear here after a season begins and round results are published." />

  let teams: Array<{ id: string; name: string }> = []
  if (user.role === 'STUDENT') {
    const memberships = await prisma.teamMember.findMany({ where: { userId: user.id, team: { seasonId: season.id } }, select: { team: { select: { id: true, name: true } } } })
    teams = memberships.map((item) => item.team)
  } else if (user.role === 'SUPERVISOR') {
    teams = await prisma.team.findMany({ where: { seasonId: season.id, supervisorId: user.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
  } else {
    teams = await prisma.team.findMany({ where: { seasonId: season.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
  }
  if (!teams.length) return <Empty title="No team available" copy={user.role === 'STUDENT' ? 'Join a current-season team to receive round debriefs.' : 'No current-season teams are in your scope.'} />

  const selectedTeam = teams.find((team) => team.id === requestedTeamId) ?? (user.role === 'STUDENT' ? teams[0] : null)
  const rounds = await prisma.round.findMany({ where: { seasonId: season.id, leaderboardVisible: true }, select: { id: true, number: true, closesAt: true, submissions: { where: selectedTeam ? { teamId: selectedTeam.id } : { teamId: '__none__' }, select: { id: true }, take: 1 }, scoreAggregates: { where: selectedTeam ? { teamId: selectedTeam.id, scopeType: 'ROUND' } : { teamId: '__none__' }, select: { id: true }, take: 1 } }, orderBy: { number: 'desc' } })

  return <div className="space-y-8">
    <div><p className="text-sm font-semibold uppercase tracking-wider text-accent">{season.name}</p><h1 className="font-display text-4xl font-semibold">Round debriefs</h1><p className="mt-2 text-text-secondary">Turn each published result into a better forecasting decision.</p></div>
    {user.role !== 'STUDENT' && <Card><CardContent className="py-5"><form className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">Team<select name="teamId" defaultValue={selectedTeam?.id || ''} className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2"><option value="">Choose a team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">View debriefs</button></form></CardContent></Card>}
    {!selectedTeam ? <Empty title="Choose a team" copy="Select a team to view its published learning history." /> : rounds.length === 0 ? <Empty title="No debriefs published yet" copy="This team’s debriefs will appear after the administrator publishes a round leaderboard." /> : <div className="grid gap-4 md:grid-cols-2">{rounds.map((round) => {
      const href = `/debrief/${round.id}${user.role === 'STUDENT' ? '' : `?teamId=${selectedTeam.id}`}`
      const state = round.scoreAggregates.length ? 'Ready to review' : round.submissions.length ? 'Scores are being prepared' : 'No submission for this round'
      return <Card key={round.id}><CardHeader><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Round {round.number}</CardTitle></CardHeader><CardContent><p className="mb-5 text-sm text-text-secondary">{state}</p>{round.scoreAggregates.length ? <Link href={href} className="inline-flex items-center gap-2 font-semibold text-primary">Open debrief <ChevronRight className="h-4 w-4" /></Link> : <span className="text-sm text-text-muted">Debrief unavailable</span>}</CardContent></Card>
    })}</div>}
  </div>
}

function Empty({ title, copy }: { title: string; copy: string }) {
  return <Card><CardContent className="py-14 text-center"><BookOpen className="mx-auto mb-4 h-9 w-9 text-text-muted" /><h2 className="font-display text-2xl font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-xl text-text-secondary">{copy}</p></CardContent></Card>
}
