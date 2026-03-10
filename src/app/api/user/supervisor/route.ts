import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'STUDENT') {
      return jsonOk({ supervisor: null })
    }

    const teamMembership = await prisma.teamMember.findFirst({
      where: { userId: user!.id },
      include: {
        team: {
          include: {
            supervisor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    })

    if (!teamMembership?.team?.supervisor) {
      return jsonOk({ supervisor: null })
    }

    return jsonOk({ supervisor: teamMembership.team.supervisor })
  } catch (error) {
    return jsonError(error, 'Failed to fetch supervisor')
  }
}
