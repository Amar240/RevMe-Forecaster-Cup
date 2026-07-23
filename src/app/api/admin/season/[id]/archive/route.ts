import { NextRequest } from 'next/server'
import { ApiError, jsonError, jsonOk, requireAdminOrResponse } from '@/server/http'
import { prisma } from '@/server/db'
import { runArchiveJob } from '@/lib/archive'

export const dynamic = 'force-dynamic'

async function getSeasonOrThrow(id: string) {
  const season = await prisma.season.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
    },
  })

  if (!season) {
    throw new ApiError('Season not found', 404, 'NOT_FOUND')
  }

  return season
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    await getSeasonOrThrow(id)

    const archive = await prisma.seasonArchive.findFirst({
      where: { seasonId: id },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })

    return jsonOk({ archive })
  } catch (error) {
    return jsonError(error, 'Failed to get season archive')
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const season = await getSeasonOrThrow(id)

    if (season.status !== 'COMPLETED') {
      throw new ApiError('Only completed seasons can be archived', 400, 'INVALID_INPUT')
    }

    const runningArchive = await prisma.seasonArchive.findFirst({
      where: {
        seasonId: id,
        status: 'RUNNING',
      },
      select: { id: true },
    })

    if (runningArchive) {
      throw new ApiError('An archive is already running for this season', 409, 'CONFLICT')
    }

    const archive = await runArchiveJob(id, user!.id)

    return jsonOk({ success: true, archiveId: archive.id })
  } catch (error) {
    return jsonError(error, 'Failed to archive season')
  }
}
