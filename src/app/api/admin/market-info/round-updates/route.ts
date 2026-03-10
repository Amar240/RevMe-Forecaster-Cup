import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json()
    const { seasonId, marketId, roundNumber, headline, whatChanged } = body

    if (!seasonId || !marketId || roundNumber === undefined || !headline || !whatChanged) {
      throw new ApiError('All fields are required', 400, 'INVALID_INPUT')
    }

    const roundUpdate = await prisma.marketRoundUpdate.upsert({
      where: { seasonId_marketId_roundNumber: { seasonId, marketId, roundNumber } },
      create: { seasonId, marketId, roundNumber, headline, whatChanged, createdById: user!.id },
      update: { headline, whatChanged },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    })

    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'UPDATE_MARKET_ROUND_UPDATE', entityType: 'MarketRoundUpdate', entityId: roundUpdate.id, details: { marketId, roundNumber, headline } },
    })

    return jsonOk({ roundUpdate })
  } catch (error) {
    return jsonError(error, 'Failed to save round update')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) throw new ApiError('ID is required', 400, 'INVALID_INPUT')

    const roundUpdate = await prisma.marketRoundUpdate.delete({ where: { id } })
    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'DELETE_MARKET_ROUND_UPDATE', entityType: 'MarketRoundUpdate', entityId: id, details: { headline: roundUpdate.headline, roundNumber: roundUpdate.roundNumber } },
    })

    return jsonOk({ success: true })
  } catch (error) {
    return jsonError(error, 'Failed to delete round update')
  }
}
