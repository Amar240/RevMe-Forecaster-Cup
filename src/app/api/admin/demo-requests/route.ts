import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/server/db'
import { jsonError, jsonOk, parseJson, requireAdminOrResponse } from '@/server/http'
import { logger } from '@/server/logger'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(['NEW', 'CONTACTED', 'SCHEDULED', 'CLOSED']),
})

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const requests = await prisma.demoRequest.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({ requests })
  } catch (error) {
    logger.error('Failed to fetch demo requests', error)
    return jsonError(error, 'Failed to fetch demo requests')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const body = await parseJson(request, updateSchema)
    const updated = await prisma.demoRequest.update({
      where: { id: body.id },
      data: { status: body.status },
    })

    return jsonOk({ request: updated })
  } catch (error) {
    logger.error('Failed to update demo request', error)
    return jsonError(error, 'Failed to update demo request')
  }
}
