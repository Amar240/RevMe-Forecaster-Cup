import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { getActiveTeamWhere } from '@/server/team-scope'

export const dynamic = 'force-dynamic'

type TeamRow = {
  id: string
  name: string
  displayId: string
  university: string
  supervisor: string
  supervisorEmail: string | null
}

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason({
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: { where: { isActive: true }, include: { market: true } },
      },
    })

    if (!operationalSeason) {
      return jsonOk({ openRound: null, openTeams: [], openSummary: { total: 0, submitted: 0, pending: 0 }, missedRound: null, missedTeams: [], markets: [] })
    }

    const now = new Date()
    const markets = operationalSeason.markets.map((m) => ({ id: m.market.id, name: m.market.name }))

    // The round currently accepting submissions (still open) vs the most recently CLOSED round.
    const openRound = operationalSeason.rounds.find((r) => new Date(r.opensAt) <= now && new Date(r.closesAt) > now) ?? null
    const missedRound = operationalSeason.rounds.filter((r) => new Date(r.closesAt) <= now).pop() ?? null

    const teams = await prisma.team.findMany({
      where: getActiveTeamWhere(operationalSeason.id),
      include: {
        supervisor: { select: { firstName: true, lastName: true, email: true } },
        university: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    const toRow = (team: (typeof teams)[number]): TeamRow => ({
      id: team.id,
      name: team.name,
      displayId: team.displayId,
      university: team.university?.name || 'Unknown',
      supervisor: team.supervisor ? `${team.supervisor.firstName} ${team.supervisor.lastName}`.trim() : 'None',
      supervisorEmail: team.supervisor?.email || null,
    })

    // Current open round: who has / hasn't submitted yet (pending is NOT a miss while time remains).
    let openTeams: (TeamRow & { hasSubmitted: boolean; submittedAt: string | null })[] = []
    let openSummary = { total: 0, submitted: 0, pending: 0 }
    if (openRound) {
      const submissions = await prisma.submission.findMany({
        where: { roundId: openRound.id },
        select: { teamId: true, submittedAt: true },
      })
      const submittedById = new Map(submissions.map((s) => [s.teamId, s.submittedAt]))
      openTeams = teams.map((team) => ({
        ...toRow(team),
        hasSubmitted: submittedById.has(team.id),
        submittedAt: submittedById.get(team.id)?.toISOString() ?? null,
      }))
      const submitted = openTeams.filter((t) => t.hasSubmitted).length
      openSummary = { total: teams.length, submitted, pending: teams.length - submitted }
    }

    // Latest closed round: teams that genuinely missed it (no submission) — these are the real misses.
    let missedTeams: TeamRow[] = []
    if (missedRound) {
      const closedSubmissions = await prisma.submission.findMany({
        where: { roundId: missedRound.id },
        select: { teamId: true },
      })
      const submittedSet = new Set(closedSubmissions.map((s) => s.teamId))
      missedTeams = teams.filter((team) => !submittedSet.has(team.id)).map(toRow)
    }

    return jsonOk({
      openRound: openRound
        ? { id: openRound.id, number: openRound.number, opensAt: openRound.opensAt.toISOString(), closesAt: openRound.closesAt.toISOString() }
        : null,
      openTeams,
      openSummary,
      missedRound: missedRound
        ? { id: missedRound.id, number: missedRound.number, closesAt: missedRound.closesAt.toISOString() }
        : null,
      missedTeams,
      markets,
    })
  } catch (error) {
    return jsonError(error, 'Failed to load submission tracker')
  }
}
