import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { id, memberId } = await params

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

    const member = team.members.find((m) => m.id === memberId)
    if (!member) {
      throw new ApiError('Member not found', 404, 'NOT_FOUND')
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    })

    if (member.isSubmitter && team.members.length > 1) {
      const remainingMember = team.members.find((m) => m.id !== memberId)
      if (remainingMember) {
        await prisma.teamMember.update({
          where: { id: remainingMember.id },
          data: { isSubmitter: true },
        })
      }
    }

    return jsonOk({ message: 'Member removed' })
  } catch (error) {
    return jsonError(error, 'Failed to remove member')
  }
}
