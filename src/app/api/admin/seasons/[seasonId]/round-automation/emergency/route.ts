import { NextRequest } from 'next/server'
import { z } from 'zod'

import { ApiError, jsonError, jsonOk, requireAdminOrResponse } from '@/server/http'
import { startOrExtendRoundAutomationEmergency } from '@/server/round-automation-emergency'
import { getRoundAutomationStatusPayload } from '@/server/round-automation-status'

export const dynamic = 'force-dynamic'

const emergencySchema = z.object({
  reason: z.string().trim().min(10).max(500),
  expectedEndAt: z.string().datetime(),
  acknowledgeConsequences: z.literal(true),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user?.role !== 'ADMIN') {
      throw new ApiError('Only a full administrator can use emergency round controls.', 403, 'FORBIDDEN')
    }

    const { seasonId } = await params
    const body = emergencySchema.parse(await request.json().catch(() => null))
    await startOrExtendRoundAutomationEmergency({
      seasonId,
      actor: { id: user.id, email: user.email, role: user.role },
      reason: body.reason,
      expectedEndAt: body.expectedEndAt,
      acknowledgeConsequences: body.acknowledgeConsequences,
    })
    return jsonOk(await getRoundAutomationStatusPayload(seasonId))
  } catch (error) {
    return jsonError(error, 'Failed to start emergency round control')
  }
}
