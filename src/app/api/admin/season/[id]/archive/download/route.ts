import { NextRequest } from 'next/server'
import { getArchiveDownloadUrl, isArchiveFileName } from '@/lib/archive'
import { ApiError, jsonError, jsonOk, requireAdminOrResponse } from '@/server/http'
import { prisma } from '@/server/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const fileName = request.nextUrl.searchParams.get('file')
    if (!isArchiveFileName(fileName)) {
      throw new ApiError('A valid archive file is required', 400, 'INVALID_INPUT')
    }

    const archive = await prisma.seasonArchive.findFirst({
      where: {
        seasonId: id,
        status: 'COMPLETED',
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })

    if (!archive) {
      throw new ApiError('No completed archive found for this season', 404, 'NOT_FOUND')
    }

    const url = await getArchiveDownloadUrl(archive, fileName)

    return jsonOk({
      url,
      fileName,
      expiresIn: 900,
    })
  } catch (error) {
    return jsonError(error, 'Failed to generate archive download')
  }
}
