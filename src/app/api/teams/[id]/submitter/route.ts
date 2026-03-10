import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const setSubmitterSchema = z.object({
  memberId: z.string(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, setSubmitterSchema)

    const team = await prisma.team.findUnique({
      where: { id },
      include: { members: true },
    })

    if (!team) {
      throw new ApiError('Team not found', 404, 'NOT_FOUND')
    }

    if (user!.role !== 'ADMIN' && team.supervisorId !== user!.id) {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const member = team.members.find((m) => m.id === data.memberId)
    if (!member) {
      throw new ApiError('Member not found', 404, 'NOT_FOUND')
    }

    await prisma.$transaction([
      prisma.teamMember.updateMany({
        where: { teamId: team.id },
        data: { isSubmitter: false },
      }),
      prisma.teamMember.update({
        where: { id: data.memberId },
        data: { isSubmitter: true },
      }),
    ])

    return jsonOk({ message: 'Submitter updated' })
  } catch (error) {
    return jsonError(error, 'Failed to set submitter')
  }
}
