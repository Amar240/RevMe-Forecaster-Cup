import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { findUniversityByNormalizedName, formatUniversityDisplayName, resolveOrCreateUniversity } from '@/server/universities'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const universitySchema = z.object({
  name: z.string().min(1),
  country: z.string().optional(),
})

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const universities = await prisma.university.findMany({
      include: { _count: { select: { users: true, teams: true } } },
      orderBy: { name: 'asc' },
    })

    return jsonOk({ universities })
  } catch (error) {
    return jsonError(error, 'Failed to get universities')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const data = await parseJson(request, universitySchema)

    const displayName = formatUniversityDisplayName(data.name)
    const existing = await findUniversityByNormalizedName(displayName)
    if (existing) throw new ApiError('University already exists', 409, 'DUPLICATE')

    const university = await resolveOrCreateUniversity({ name: displayName, country: data.country || null })
    return jsonOk({ university }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create university')
  }
}
