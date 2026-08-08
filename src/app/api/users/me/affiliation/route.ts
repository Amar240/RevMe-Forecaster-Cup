import { NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, jsonOk, parseJson, requireUserOrResponse } from '@/server/http'
import { selfCorrectSupervisorAffiliation } from '@/server/affiliation-correction'

export const dynamic = 'force-dynamic'

const correctionSchema = z.object({
  targetUniversityId: z.string().trim().min(1),
  universityConfirmed: z.literal(true),
  reason: z.string().trim().min(5).max(500),
})

export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const data = await parseJson(request, correctionSchema)
    const updatedUser = await selfCorrectSupervisorAffiliation({
      actor: user!,
      targetUniversityId: data.targetUniversityId,
      reason: data.reason,
    })
    return jsonOk({ message: 'University affiliation corrected.', user: updatedUser })
  } catch (error) {
    return jsonError(error, 'Failed to correct university affiliation')
  }
}
