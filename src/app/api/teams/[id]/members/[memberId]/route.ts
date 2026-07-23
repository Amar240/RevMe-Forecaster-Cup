import { NextRequest } from 'next/server'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { removeMemberFromTeam } from '@/server/team-roster'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { id, memberId } = await params
    if (user!.role !== 'ADMIN' && user!.role !== 'SUPERVISOR') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    let replacementMemberId: string | undefined
    const rawBody = await request.text()
    if (rawBody) {
      let parsed: { replacementMemberId?: string }
      try {
        parsed = JSON.parse(rawBody) as { replacementMemberId?: string }
      } catch {
        throw new ApiError('Invalid JSON', 400, 'INVALID_JSON')
      }
      replacementMemberId = parsed.replacementMemberId
    }

    await removeMemberFromTeam({
      actor: user!,
      access: user!.role === 'ADMIN' ? 'admin' : 'supervisor',
      teamId: id,
      memberId,
      replacementMemberId,
    })

    return jsonOk({ message: 'Member removed' })
  } catch (error) {
    return jsonError(error, 'Failed to remove member')
  }
}
