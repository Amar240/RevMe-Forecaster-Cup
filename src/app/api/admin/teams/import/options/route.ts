import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const seasons = await prisma.season.findMany({
      where: {
        status: {
          not: 'COMPLETED',
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    })

    return jsonOk({ seasons })
  } catch (error) {
    return jsonError(error, 'Failed to load import options')
  }
}
