import { NextRequest } from 'next/server'
import { z } from 'zod'

import { ApiError, jsonError, jsonOk, requireAdminOrResponse } from '@/server/http'
import { resumeAutomaticRoundScheduling } from '@/server/round-automation-emergency'
import { getRoundAutomationStatusPayload } from '@/server/round-automation-status'

export const dynamic = 'force-dynamic'

const resumeSchema = z.object({
  fingerprint: z.string().length(64),
  reason: z.string().trim().min(10).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user?.role !== 'ADMIN') {
      throw new ApiError('Only a full administrator can resume automatic round scheduling.', 403, 'FORBIDDEN')
    }

    const { seasonId } = await params
    const body = resumeSchema.parse(await request.json().catch(() => null))
    await resumeAutomaticRoundScheduling({
      seasonId,
      actor: { id: user.id, email: user.email, role: user.role },
      fingerprint: body.fingerprint,
      reason: body.reason,
    })
    return jsonOk(await getRoundAutomationStatusPayload(seasonId))
  } catch (error) {
    return jsonError(error, 'Failed to resume automatic round scheduling')
  }
}
