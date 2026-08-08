import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { jsonOk, jsonError } from '@/server/http'
import { normalizeUniversityName } from '@/server/universities'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')?.trim() || ''
    const normalizedQuery = query ? normalizeUniversityName(query) : ''

    const universities = await prisma.university.findMany({
      where: { isListed: true },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        country: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    })

    const seen = new Set<string>()
    const options: { id: string; name: string; country: string | null; normalizedName: string }[] = []

    for (const university of universities) {
      const normalizedName = normalizeUniversityName(university.normalizedName || university.name)
      if (normalizedQuery && !normalizedName.includes(normalizedQuery)) {
        continue
      }

      if (seen.has(normalizedName)) {
        continue
      }

      seen.add(normalizedName)
      options.push({
        id: university.id,
        name: university.name,
        country: university.country,
        normalizedName,
      })

    }

    return jsonOk({ universities: options })
  } catch (error) {
    return jsonError(error, 'Failed to load universities')
  }
}
