import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
      include: { rounds: true },
    })

    if (!activeSeason) return jsonOk({ pendingTeams: [], pendingCount: 0 })

    const now = new Date()
    const currentRound = activeSeason.rounds.find((round) => {
      const isTimeOpen = new Date(round.closesAt) > now && new Date(round.opensAt) <= now
      const isStatusOpen = round.status === 'OPEN'
      return isTimeOpen && isStatusOpen
    })

    if (!currentRound) return jsonOk({ pendingTeams: [], pendingCount: 0 })

    const submissions = await prisma.submission.findMany({
      where: { roundId: currentRound.id }, select: { teamId: true }, distinct: ['teamId'],
    })
    const submittedTeamIds = new Set(submissions.map((s) => s.teamId))

    const activeTeams = await prisma.team.findMany({
      where: { status: 'ACTIVE', seasonId: activeSeason.id },
      include: {
        university: true, supervisor: true,
        submissions: { take: 1, orderBy: { submittedAt: 'desc' }, select: { submittedAt: true } },
        _count: { select: { warnings: true } },
      },
    })

    const pendingTeams = activeTeams
      .filter((team) => !submittedTeamIds.has(team.id))
      .map((team) => ({
        id: team.id, teamName: team.name, teamDisplayId: team.displayId,
        universityName: team.university?.name ?? 'Not set',
        supervisorName: `${team.supervisor.firstName} ${team.supervisor.lastName}`,
        supervisorEmail: team.supervisor.email,
        warningsCount: team._count.warnings,
        lastSubmissionAt: team.submissions[0]?.submittedAt?.toISOString() ?? null,
      }))

    return jsonOk({ pendingTeams, pendingCount: pendingTeams.length })
  } catch (error) {
    return jsonError(error, 'Failed to fetch pending submissions')
  }
}
