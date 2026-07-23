import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import {
  findUniversityByNormalizedName,
  formatUniversityDisplayName,
  getUniversityDeleteEligibility,
  normalizeUniversityName,
} from '@/server/universities'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateUniversitySchema = z.object({
  name: z.string().trim().min(1),
  country: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, updateUniversitySchema)
    const displayName = formatUniversityDisplayName(data.name)

    const university = await prisma.university.findUnique({
      where: { id },
    })

    if (!university) {
      throw new ApiError('University not found', 404, 'NOT_FOUND')
    }

    const existing = await findUniversityByNormalizedName(displayName)
    if (existing && existing.id !== id) {
      throw new ApiError('University already exists', 409, 'DUPLICATE')
    }

    const updatedUniversity = await prisma.university.update({
      where: { id },
      data: {
        name: displayName,
        normalizedName: normalizeUniversityName(displayName),
        country: data.country?.trim() || null,
      },
    })

    return jsonOk({ university: updatedUniversity })
  } catch (error) {
    return jsonError(error, 'Failed to update university')
  }
}

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
