import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { sendMissedSubmissionWarning } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const activeSeason = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
    if (!activeSeason) throw new ApiError('No active season', 400, 'INVALID_INPUT')

    const closedRounds = await prisma.round.findMany({
      where: { seasonId: activeSeason.id, closesAt: { lt: new Date() } }, orderBy: { number: 'desc' },
    })
    if (closedRounds.length === 0) throw new ApiError('No closed rounds', 400, 'INVALID_INPUT')

    const lastClosedRound = closedRounds[0]
    const teams = await prisma.team.findMany({
      where: { status: 'ACTIVE' },
      include: { members: { include: { user: true } }, warnings: true },
    })

    const submissions = await prisma.submission.findMany({
      where: { roundId: lastClosedRound.id }, select: { teamId: true },
    })
    const submittedTeamIds = new Set(submissions.map((s) => s.teamId))

    let warningsIssued = 0, disqualified = 0, emailsSent = 0

    for (const team of teams) {
      if (submittedTeamIds.has(team.id)) continue
      const existingWarning = await prisma.warning.findFirst({ where: { teamId: team.id, roundId: lastClosedRound.id } })
      if (existingWarning) continue

      await prisma.warning.create({
        data: { teamId: team.id, roundId: lastClosedRound.id, type: 'MISSED_SUBMISSION', message: `Missed submission for Round ${lastClosedRound.number}` },
      })
      warningsIssued++

      const warningCount = team.warnings.length + 1
      if (warningCount >= 3) {
        await prisma.team.update({ where: { id: team.id }, data: { status: 'DISQUALIFIED' } })
        disqualified++
      }

      for (const member of team.members) {
        const sent = await sendMissedSubmissionWarning(member.user.email, team.name, lastClosedRound.number, warningCount)
        if (sent) emailsSent++
      }
    }

    return jsonOk({ message: `Processed missed submissions: ${warningsIssued} warnings, ${disqualified} disqualified, ${emailsSent} emails sent`, warningsIssued, disqualified, emailsSent })
  } catch (error) {
    return jsonError(error, 'Failed to process missed submissions')
  }
}
