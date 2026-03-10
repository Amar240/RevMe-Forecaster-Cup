import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const markets = await prisma.market.findMany({
      orderBy: { name: 'asc' },
    })

    return jsonOk({ markets })
  } catch (error) {
    return jsonError(error, 'Failed to fetch markets')
  }
}
