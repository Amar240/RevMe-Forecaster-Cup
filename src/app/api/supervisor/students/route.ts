import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { managedUserListSelect, createManagedUser } from '@/server/user-management'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    if (!user!.universityId) {
      return jsonOk({
        students: [],
        total: 0,
        universityId: null,
        universityName: null,
        canManage: false,
        message: 'Your supervisor account must be linked to a university before you can manage students.',
      })
    }

    const supervisor = await prisma.user.findUnique({
      where: { id: user!.id },
      select: {
        university: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        universityId: user!.universityId,
      },
      select: managedUserListSelect,
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({
      students,
      total: students.length,
      universityId: user!.universityId,
      universityName: supervisor?.university?.name ?? null,
      canManage: true,
    })
  } catch (error) {
    return jsonError(error, 'Failed to load students')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    if (user!.role !== 'SUPERVISOR') {
      throw new ApiError('Forbidden', 403, 'FORBIDDEN')
    }

    const body = await request.json() as {
      firstName?: string
      lastName?: string
      email?: string
    }

    const result = await createManagedUser({
      actor: user!,
      scope: 'supervisor-student',
      firstName: body.firstName ?? '',
      lastName: body.lastName ?? '',
      email: body.email ?? '',
    })

    return jsonOk(result, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create student')
  }
}
