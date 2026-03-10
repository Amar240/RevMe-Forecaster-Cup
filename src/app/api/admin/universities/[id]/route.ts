import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    await prisma.university.delete({ where: { id } })
    return jsonOk({ message: 'University deleted' })
  } catch (error) {
    return jsonError(error, 'Failed to delete university')
  }
}
