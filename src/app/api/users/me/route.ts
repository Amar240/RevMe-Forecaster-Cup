import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { z } from 'zod'
import { getSupervisorSelfCorrectionEligibility } from '@/server/affiliation-correction'

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
    const affiliationCorrection = user!.role === 'SUPERVISOR'
      ? await getSupervisorSelfCorrectionEligibility(user!.id)
      : null

    if (!operationalSeason) {
      const fullUser = await prisma.user.findUnique({
        where: { id: user!.id },
        include: {
          university: true, oauthAccounts: { where: { provider: 'GOOGLE' }, select: { email: true } },
        },
      })

      return jsonOk({
        user: fullUser ? { ...fullUser, passwordHash: undefined, oauthAccounts: undefined, teamMemberships: [], affiliationCorrection, loginMethods: { hasPassword: Boolean(fullUser.passwordHash), google: { connected: Boolean(fullUser.oauthAccounts[0]), email: fullUser.oauthAccounts[0]?.email ?? null } } } : null,
      })
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user!.id },
      include: {
        university: true, oauthAccounts: { where: { provider: 'GOOGLE' }, select: { email: true } },
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

    return jsonOk({ user: fullUser ? { ...fullUser, passwordHash: undefined, oauthAccounts: undefined, affiliationCorrection, loginMethods: { hasPassword: Boolean(fullUser.passwordHash), google: { connected: Boolean(fullUser.oauthAccounts[0]), email: fullUser.oauthAccounts[0]?.email ?? null } } } : null })
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
