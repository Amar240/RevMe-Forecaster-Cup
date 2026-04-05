import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
})

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const operationalSeason = await getCurrentOperationalSeason()
    if (!operationalSeason) {
      const fullUser = await prisma.user.findUnique({
        where: { id: user!.id },
        include: {
          university: true,
        },
      })

      return jsonOk({
        user: fullUser ? { ...fullUser, teamMemberships: [] } : null,
      })
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user!.id },
      include: {
        university: true,
        teamMemberships: {
          where: { team: { seasonId: operationalSeason.id } },
          include: {
            team: {
              include: { supervisor: true },
            },
          },
        },
      },
    })

    return jsonOk({ user: fullUser })
  } catch (error) {
    return jsonError(error, 'Failed to get user')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const data = await parseJson(request, updateProfileSchema)

    const updatedUser = await prisma.user.update({
      where: { id: user!.id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
      },
    })

    return jsonOk({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
      },
    })
  } catch (error) {
    return jsonError(error, 'Failed to update profile')
  }
}
