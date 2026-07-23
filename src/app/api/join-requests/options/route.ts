import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { sameUniversity } from '@/server/universities'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'STUDENT') {
      throw new ApiError('Only students can request to join teams.', 403, 'FORBIDDEN')
    }

    const student = await prisma.user.findUnique({
      where: { id: user!.id },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            normalizedName: true,
          },
        },
      },
    })

    if (!student) {
      throw new ApiError('Student not found', 404, 'NOT_FOUND')
    }

    if (!student.universityId || !student.university) {
      return jsonOk({
        studentUniversity: null,
        supervisors: [],
      })
    }

    const supervisors = await prisma.user.findMany({
      where: { role: 'SUPERVISOR' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        university: {
          select: {
            id: true,
            name: true,
            normalizedName: true,
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
    })

    return jsonOk({
      studentUniversity: {
        id: student.university.id,
        name: student.university.name,
      },
      supervisors: supervisors
        .filter((supervisor) => supervisor.university && sameUniversity(student.university, supervisor.university))
        .map(({ university: _university, ...supervisor }) => supervisor),
    })
  } catch (error) {
    return jsonError(error, 'Failed to load join-request options')
  }
}
