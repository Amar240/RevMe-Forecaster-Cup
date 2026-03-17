import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { prisma } from '@/lib/db'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const schema = z.object({
  field: z.enum(['leaderboardReviewed', 'participantsNotified']),
  value: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const { field, value } = await parseJson(request, schema)

    const round = await prisma.round.findUnique({ where: { id } })
    if (!round) throw new ApiError('Round not found', 404, 'NOT_FOUND')

    await prisma.round.update({
      where: { id },
      data: { [field]: value },
    })

    await logAuditAction(
      user!.id,
      'UPDATE_ROUND_CHECKLIST',
      'Round',
      id,
      { roundNumber: round.number, field, value },
      null
    )

    return jsonOk({ message: 'Checklist updated' })
  } catch (error) {
    return jsonError(error, 'Failed to update checklist')
  }
}
