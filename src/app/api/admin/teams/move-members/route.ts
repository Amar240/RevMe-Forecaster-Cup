import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { moveTeamMembers } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

const moveMembersSchema = z.object({
  sourceTeamId: z.string().min(1),
  targetTeamId: z.string().min(1),
  memberIds: z.array(z.string().min(1)).min(1),
  sourceReplacementMemberId: z.string().min(1).nullable().optional(),
  targetSubmitterMemberId: z.string().min(1).nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const data = await parseJson(request, moveMembersSchema)
    const result = await moveTeamMembers({
      actor: user!,
      sourceTeamId: data.sourceTeamId,
      targetTeamId: data.targetTeamId,
      memberIds: data.memberIds,
      sourceReplacementMemberId: data.sourceReplacementMemberId,
      targetSubmitterMemberId: data.targetSubmitterMemberId,
    })

    return jsonOk(result)
  } catch (error) {
    return jsonError(error, 'Failed to move members')
  }
}
