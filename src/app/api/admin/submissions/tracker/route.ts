import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: {
        rounds: { orderBy: { number: 'asc' } },
        markets: { where: { isActive: true }, include: { market: true } },
      },
    })

    if (!activeSeason) return jsonOk({ teams: [], round: null, markets: [] })

    const now = new Date()
    const currentRound = activeSeason.rounds.find(r => 
      new Date(r.closesAt) > now && new Date(r.opensAt) <= now
    ) || activeSeason.rounds.filter(r => new Date(r.closesAt) <= now).pop()

    if (!currentRound) return jsonOk({ teams: [], round: null, markets: activeSeason.markets.map(m => m.market) })

    const teams = await prisma.team.findMany({
      where: { status: 'ACTIVE', seasonId: activeSeason.id },
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
      markets: activeSeason.markets.map(m => ({ id: m.market.id, name: m.market.name })),
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
