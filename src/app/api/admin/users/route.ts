import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse('users:manage')
    if (response) return response

    const users = await prisma.user.findMany({
      include: {
        university: true,
        teamMemberships: { include: { team: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({ users, total: users.length })
  } catch (error) {
    return jsonError(error, 'Failed to get users')
  }
}
