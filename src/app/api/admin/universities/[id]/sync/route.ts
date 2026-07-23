import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const syncUniversitySchema = z.object({
  targetUniversityId: z.string().trim().min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, syncUniversitySchema)

    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.university.findUnique({
        where: { id },
      })

      if (!source) {
        throw new ApiError('University not found', 404, 'NOT_FOUND')
      }

      if (source.isListed) {
        throw new ApiError('Only pending universities can be merged.', 422, 'INVALID_INPUT')
      }

      if (source.id === data.targetUniversityId) {
        throw new ApiError('Cannot merge a university into itself.', 422, 'INVALID_INPUT')
      }

      const target = await tx.university.findUnique({
        where: { id: data.targetUniversityId },
      })

      if (!target || !target.isListed) {
        throw new ApiError('Target university must be a listed university.', 422, 'INVALID_INPUT')
      }

      await tx.user.updateMany({
        where: { universityId: source.id },
        data: { universityId: target.id },
      })

      await tx.team.updateMany({
        where: { universityId: source.id },
        data: { universityId: target.id },
      })

      const [remainingUsers, remainingTeams] = await Promise.all([
        tx.user.count({ where: { universityId: source.id } }),
        tx.team.count({ where: { universityId: source.id } }),
      ])

      const deletedSource = remainingUsers === 0 && remainingTeams === 0

      if (deletedSource) {
        await tx.university.delete({
          where: { id: source.id },
        })
      }

      return {
        merged: true,
        deletedSource,
      }
    })

    return jsonOk(result)
  } catch (error) {
    return jsonError(error, 'Failed to sync university')
  }
}
