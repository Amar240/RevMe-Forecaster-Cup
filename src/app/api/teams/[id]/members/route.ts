import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const addMemberSchema = z.object({
  email: z.string().email(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { id } = await params
    const data = await parseJson(request, addMemberSchema)

    const team = await prisma.team.findUnique({
      where: { id },
      include: { members: true },
    })

    if (!team) {
      throw new ApiError('Team not found', 404, 'NOT_FOUND')
    }

    if (user!.role !== 'ADMIN' && team.supervisorId !== user!.id) {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    if (team.members.length >= 5) {
      throw new ApiError('Maximum 5 students per team', 422, 'CONFLICT')
    }

    const student = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (!student) {
      throw new ApiError('Student not found. They must register first.', 404, 'NOT_FOUND')
    }

    if (student.role !== 'STUDENT') {
      throw new ApiError('User is not a student', 422, 'INVALID_INPUT')
    }

    const existingMembership = await prisma.teamMember.findFirst({
      where: { userId: student.id },
    })

    if (existingMembership) {
      throw new ApiError('Student is already on a team', 409, 'CONFLICT')
    }

    const isFirstMember = team.members.length === 0

    const member = await prisma.teamMember.create({
      data: {
        userId: student.id,
        teamId: team.id,
        isSubmitter: isFirstMember,
      },
      include: { user: true },
    })

    return jsonOk({ member }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to add member')
  }
}
