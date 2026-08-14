import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { assignMissedSubmissionWarnings } from '@/server/missed-submission-warnings'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const activeSeason = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
    if (!activeSeason) throw new ApiError('No active season', 400, 'INVALID_INPUT')

    const hasClosedRound = await prisma.round.findFirst({
      where: { seasonId: activeSeason.id, closesAt: { lt: new Date() } },
      select: { id: true },
    })
    if (!hasClosedRound) throw new ApiError('No closed rounds', 400, 'INVALID_INPUT')

    // Shared, idempotent path: creates warnings, emails members, disqualifies at the threshold.
    const { warningsCreated, teamsDisqualified, emailsSent } = await assignMissedSubmissionWarnings({
      seasonId: activeSeason.id,
      sendEmail: true,
      actorId: user!.id,
    })

    return jsonOk({
      message: `Processed missed submissions: ${warningsCreated} warnings, ${teamsDisqualified} disqualified, ${emailsSent} emails sent`,
      warningsIssued: warningsCreated,
      disqualified: teamsDisqualified,
      emailsSent,
    })
  } catch (error) {
    return jsonError(error, 'Failed to process missed submissions')
  }
}
