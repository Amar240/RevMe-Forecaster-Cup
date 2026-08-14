import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'
import { assignMissedSubmissionWarnings } from '@/server/missed-submission-warnings'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    // Delegates to the shared assignment logic (same path used automatically on round close), which is
    // idempotent and now also sends the N/3 warning email.
    const { warningsCreated, teamsDisqualified } = await assignMissedSubmissionWarnings({
      sendEmail: true,
      actorId: user!.id,
    })

    await logAuditAction(user!.id, 'RUN_WARNINGS', 'System', null, {
      warningsCreated,
      teamsDisqualified,
    })

    return jsonOk({
      message: warningsCreated > 0 ? 'Warnings check complete' : 'No new warnings to issue',
      warningsCreated,
      teamsDisqualified,
    })
  } catch (error) {
    return jsonError(error, 'Warnings check failed')
  }
}
