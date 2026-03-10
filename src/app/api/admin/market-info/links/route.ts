import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json()
    const { marketInfoId, label, url, type, note } = body

    if (!marketInfoId || !label || !url) throw new ApiError('marketInfoId, label, and url are required', 400, 'INVALID_INPUT')

    const maxOrder = await prisma.marketResourceLink.aggregate({ where: { marketInfoId }, _max: { order: true } })
    const link = await prisma.marketResourceLink.create({
      data: { marketInfoId, label, url, type: type || 'OTHER', note, order: (maxOrder._max.order || 0) + 1 },
    })

    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'CREATE_MARKET_LINK', entityType: 'MarketResourceLink', entityId: link.id, details: { label, url, type } },
    })

    return jsonOk({ link })
  } catch (error) {
    return jsonError(error, 'Failed to create link')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json()
    const { id, label, url, type, note, order } = body

    if (!id) throw new ApiError('Link ID is required', 400, 'INVALID_INPUT')

    const link = await prisma.marketResourceLink.update({
      where: { id },
      data: { ...(label && { label }), ...(url && { url }), ...(type && { type }), ...(note !== undefined && { note }), ...(order !== undefined && { order }) },
    })

    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'UPDATE_MARKET_LINK', entityType: 'MarketResourceLink', entityId: link.id, details: { label, url, type } },
    })

    return jsonOk({ link })
  } catch (error) {
    return jsonError(error, 'Failed to update link')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) throw new ApiError('Link ID is required', 400, 'INVALID_INPUT')

    const link = await prisma.marketResourceLink.delete({ where: { id } })
    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'DELETE_MARKET_LINK', entityType: 'MarketResourceLink', entityId: id, details: { label: link.label } },
    })

    return jsonOk({ success: true })
  } catch (error) {
    return jsonError(error, 'Failed to delete link')
  }
}
