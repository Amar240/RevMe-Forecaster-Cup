import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import {
  createManagedUser,
  getManagedUserDeleteEligibility,
  managedUserListSelect,
} from '@/server/user-management'

export const dynamic = 'force-dynamic'

const createStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  universityId: z.string().min(1, 'University is required'),
})

export async function GET() {
  try {
    const { user, response } = await requireAdminOrResponse('users:manage')
    if (response) return response

    const users = await prisma.user.findMany({
      select: managedUserListSelect,
      orderBy: { createdAt: 'desc' },
    })

    return jsonOk({
      users: users.map((currentUser) => ({
        ...currentUser,
        ...getManagedUserDeleteEligibility({
          actorId: user!.id,
          user: currentUser,
        }),
      })),
      total: users.length,
    })
  } catch (error) {
    return jsonError(error, 'Failed to get users')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse('users:manage')
    if (response) return response

    const { firstName, lastName, email, universityId } = await parseJson(request, createStudentSchema)

    const result = await createManagedUser({
      actor: user!,
      scope: 'admin-student',
      firstName,
      lastName,
      email,
      universityId,
    })

    return jsonOk({ user: result.user, emailSent: result.emailSent }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create student')
  }
}
