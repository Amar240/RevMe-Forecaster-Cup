import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { getUniversityDeleteEligibility } from '@/server/universities'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const university = await prisma.university.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            teams: true,
          },
        },
      },
    })

    if (!university) {
      throw new ApiError('University not found', 404, 'NOT_FOUND')
    }

    const eligibility = getUniversityDeleteEligibility({
      userCount: university._count.users,
      teamCount: university._count.teams,
    })

    if (!eligibility.canDelete) {
      throw new ApiError(
        eligibility.deleteBlockedReason ?? 'This university cannot be deleted.',
        422,
        'INVALID_INPUT'
      )
    }

    await prisma.university.delete({ where: { id } })
    return jsonOk({ message: 'University deleted successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to delete university')
  }
}
