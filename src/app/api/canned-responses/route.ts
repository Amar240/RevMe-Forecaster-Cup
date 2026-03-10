import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR' && user!.role !== 'ADMIN' && user!.role !== 'SUB_ADMIN') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const whereClause: Record<string, unknown> = {
      OR: [{ createdById: user!.id }, { isGlobal: true }],
    }
    if (category && category !== 'all') whereClause.category = category

    const responses = await prisma.cannedResponse.findMany({
      where: whereClause,
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ usageCount: 'desc' }, { title: 'asc' }],
    })

    return jsonOk({ responses })
  } catch (error) {
    return jsonError(error, 'Failed to fetch canned responses')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR' && user!.role !== 'ADMIN' && user!.role !== 'SUB_ADMIN') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const body = await request.json()
    const { title, content, category, isGlobal } = body

    if (!title || !content) throw new ApiError('Title and content are required', 400, 'INVALID_INPUT')

    const cannedResponse = await prisma.cannedResponse.create({
      data: {
        title, content, category: category || 'GENERAL', createdById: user!.id,
        isGlobal: user!.role === 'ADMIN' ? (isGlobal ?? false) : false,
      },
    })

    return jsonOk({ response: cannedResponse })
  } catch (error) {
    return jsonError(error, 'Failed to create canned response')
  }
}
