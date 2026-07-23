import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { getActiveTeamWhere } from '@/server/team-scope'

export const dynamic = 'force-dynamic'

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

    if (!operationalSeason) return jsonOk({ teams: [], round: null, markets: [] })

    const now = new Date()
    const currentRound = operationalSeason.rounds.find(r => 
      new Date(r.closesAt) > now && new Date(r.opensAt) <= now
    ) || operationalSeason.rounds.filter(r => new Date(r.closesAt) <= now).pop()

    if (!currentRound) return jsonOk({ teams: [], round: null, markets: operationalSeason.markets.map(m => m.market) })

    const teams = await prisma.team.findMany({
      where: getActiveTeamWhere(operationalSeason.id),
      include: {
        supervisor: { select: { firstName: true, lastName: true, email: true } },
        university: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    const submissions = await prisma.submission.findMany({
      where: { roundId: currentRound.id },
      select: { teamId: true, submittedAt: true, locked: true },
    })

    const submittedTeamIds = new Set(submissions.map(s => s.teamId))

    const teamData = teams.map(team => ({
      id: team.id,
      name: team.name,
      displayId: team.displayId,
      university: team.university?.name || 'Unknown',
      supervisor: team.supervisor ? `${team.supervisor.firstName} ${team.supervisor.lastName}` : 'None',
      supervisorEmail: team.supervisor?.email || null,
      hasSubmitted: submittedTeamIds.has(team.id),
      submittedAt: submissions.find(s => s.teamId === team.id)?.submittedAt?.toISOString() || null,
    }))

    return jsonOk({
      round: {
        id: currentRound.id,
        number: currentRound.number,
        opensAt: currentRound.opensAt.toISOString(),
        closesAt: currentRound.closesAt.toISOString(),
      },
      markets: operationalSeason.markets.map(m => ({ id: m.market.id, name: m.market.name })),
      teams: teamData,
      summary: {
        total: teams.length,
        submitted: submittedTeamIds.size,
        missing: teams.length - submittedTeamIds.size,
      },
    })
  } catch (error) {
    return jsonError(error, 'Failed to load submission tracker')
  }
}
