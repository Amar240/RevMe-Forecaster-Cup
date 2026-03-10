import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { sendRoundOpenEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const activeSeason = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
    if (!activeSeason) throw new ApiError('No active season', 400, 'INVALID_INPUT')

    const currentRound = await prisma.round.findFirst({
      where: { seasonId: activeSeason.id, opensAt: { lte: new Date() }, closesAt: { gt: new Date() } },
    })
    if (!currentRound) throw new ApiError('No active round', 400, 'INVALID_INPUT')

    const teams = await prisma.team.findMany({
      where: { status: 'ACTIVE' },
      include: { members: { where: { isSubmitter: true }, include: { user: true } } },
    })

    const existingSubmissions = await prisma.submission.findMany({
      where: { roundId: currentRound.id }, select: { teamId: true },
    })
    const submittedTeamIds = new Set(existingSubmissions.map((s) => s.teamId))

    let emailsSent = 0
    for (const team of teams) {
      if (submittedTeamIds.has(team.id)) continue
      const submitter = team.members[0]
      if (submitter?.user.email) {
        const sent = await sendRoundOpenEmail(submitter.user.email, currentRound.number, currentRound.closesAt, team.name)
        if (sent) emailsSent++
      }
    }

    return jsonOk({ message: `Sent ${emailsSent} round reminder emails`, emailsSent })
  } catch (error) {
    return jsonError(error, 'Failed to send reminders')
  }
}
