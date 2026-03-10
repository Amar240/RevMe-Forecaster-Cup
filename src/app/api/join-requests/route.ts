import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const requests = await prisma.joinRequest.findMany({
      where: { studentId: user!.id },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
        season: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({ requests })
  } catch (error) {
    return jsonError(error, 'Failed to fetch join requests')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'STUDENT') {
      throw new ApiError('Only students can create join requests', 403, 'FORBIDDEN')
    }

    const body = await request.json()
    const { supervisorEmail, message } = body

    if (!supervisorEmail) {
      throw new ApiError('Supervisor email is required', 400, 'INVALID_INPUT')
    }

    const existingMembership = await prisma.teamMember.findFirst({
      where: { userId: user!.id },
    })

    if (existingMembership) {
      throw new ApiError('You are already a member of a team', 400, 'CONFLICT')
    }

    const pendingRequest = await prisma.joinRequest.findFirst({
      where: { studentId: user!.id, status: 'PENDING' },
    })

    if (pendingRequest) {
      throw new ApiError('You already have a pending join request', 400, 'CONFLICT')
    }

    const supervisor = await prisma.user.findFirst({
      where: { email: supervisorEmail.toLowerCase(), role: 'SUPERVISOR' },
    })

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    const joinRequest = await prisma.joinRequest.create({
      data: {
        studentId: user!.id,
        supervisorId: supervisor?.id || null,
        supervisorEmailEntered: supervisorEmail.toLowerCase(),
        seasonId: activeSeason?.id || null,
        message: message || null,
        status: 'PENDING',
      },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return jsonOk({ request: joinRequest })
  } catch (error) {
    return jsonError(error, 'Failed to create join request')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')

    if (!requestId) {
      throw new ApiError('Request ID is required', 400, 'INVALID_INPUT')
    }

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
    })

    if (!joinRequest || joinRequest.studentId !== user!.id) {
      throw new ApiError('Join request not found', 404, 'NOT_FOUND')
    }

    if (joinRequest.status !== 'PENDING') {
      throw new ApiError('Only pending requests can be canceled', 400, 'INVALID_INPUT')
    }

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELED' },
    })

    return jsonOk({ message: 'Request canceled' })
  } catch (error) {
    return jsonError(error, 'Failed to cancel join request')
  }
}
