import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { ensureStandardMarkets } from '@/server/standard-markets'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const marketSchema = z.object({
  name: z.string(),
})

function normalizeMarketName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    await ensureStandardMarkets(prisma)

    const markets = await prisma.market.findMany({
      orderBy: { name: 'asc' },
    })

    return jsonOk({ markets })
  } catch (error) {
    return jsonError(error, 'Failed to fetch markets')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const data = await parseJson(request, marketSchema)
    const normalizedName = normalizeMarketName(data.name)

    if (!normalizedName) {
      throw new ApiError('Enter a market name.', 400, 'INVALID_INPUT')
    }

    const existingMarkets = await prisma.market.findMany({
      select: { name: true },
    })

    const normalizedCandidate = normalizedName.toLowerCase()
    const duplicateExists = existingMarkets.some(
      (market) => normalizeMarketName(market.name).toLowerCase() === normalizedCandidate
    )

    if (duplicateExists) {
      throw new ApiError('A market with this name already exists.', 409, 'DUPLICATE')
    }

    const market = await prisma.market.create({
      data: { name: normalizedName },
    })

    return jsonOk({ market }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create market')
  }
}
