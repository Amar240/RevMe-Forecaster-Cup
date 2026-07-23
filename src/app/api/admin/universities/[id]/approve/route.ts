import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const university = await prisma.university.findUnique({
      where: { id },
    })

    if (!university) {
      throw new ApiError('University not found', 404, 'NOT_FOUND')
    }

    if (university.isListed) {
      throw new ApiError('University is already approved.', 422, 'INVALID_INPUT')
    }

    const updatedUniversity = await prisma.university.update({
      where: { id },
      data: { isListed: true },
    })

    return jsonOk({ university: updatedUniversity })
  } catch (error) {
    return jsonError(error, 'Failed to approve university')
  }
}
