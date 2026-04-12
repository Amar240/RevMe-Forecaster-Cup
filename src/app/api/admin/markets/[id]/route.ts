import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const STARTED_SEASON_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'] as const
const LOCKED_MARKET_MESSAGE = 'This market is already used in a started season and can no longer be changed.'

const updateMarketSchema = z.object({
  name: z.string(),
})

function normalizeMarketName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

async function getMarketWithLockState(id: string) {
  const market = await prisma.market.findUnique({
    where: { id },
    include: {
      seasonMarkets: {
        where: {
          season: {
            status: {
              in: [...STARTED_SEASON_STATUSES],
            },
          },
        },
        select: {
          id: true,
        },
      },
    },
  })

  if (!market) {
    throw new ApiError('Market not found', 404, 'NOT_FOUND')
  }

  return {
    market,
    isLocked: market.seasonMarkets.length > 0,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, updateMarketSchema)
    const normalizedName = normalizeMarketName(data.name)

    if (!normalizedName) {
      throw new ApiError('Enter a market name.', 400, 'INVALID_INPUT')
    }

    const { isLocked } = await getMarketWithLockState(id)

    if (isLocked) {
      throw new ApiError(LOCKED_MARKET_MESSAGE, 422, 'INVALID_INPUT')
    }

    const existingMarkets = await prisma.market.findMany({
      where: {
        NOT: { id },
      },
      select: { name: true },
    })

    const normalizedCandidate = normalizedName.toLowerCase()
    const duplicateExists = existingMarkets.some(
      (market) => normalizeMarketName(market.name).toLowerCase() === normalizedCandidate
    )

    if (duplicateExists) {
      throw new ApiError('A market with this name already exists.', 409, 'DUPLICATE')
    }

    const market = await prisma.market.update({
      where: { id },
      data: { name: normalizedName },
    })

    return jsonOk({ market })
  } catch (error) {
    return jsonError(error, 'Failed to update market')
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const { isLocked } = await getMarketWithLockState(id)

    if (isLocked) {
      throw new ApiError(LOCKED_MARKET_MESSAGE, 422, 'INVALID_INPUT')
    }

    await prisma.market.delete({
      where: { id },
    })

    return jsonOk({ message: 'Market deleted successfully' })
  } catch (error) {
    return jsonError(error, 'Failed to delete market')
  }
}
