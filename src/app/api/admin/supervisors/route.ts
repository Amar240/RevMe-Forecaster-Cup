import { requireAdmin, jsonOk, jsonError, parseJson } from '@/server/http'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createManagedUser } from '@/server/user-management'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await requireAdmin()

    const supervisors = await prisma.user.findMany({
      where: { role: 'SUPERVISOR' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        universityId: true,
        university: { select: { id: true, name: true } },
        _count: { select: { supervisedTeams: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return jsonOk({ supervisors })
  } catch (error) {
    return jsonError(error, 'Failed to fetch supervisors')
  }
}

const createSupervisorSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  universityId: z.string().min(1, 'University is required'),
})

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin()

    const { firstName, lastName, email, universityId } = await parseJson(
      request as import('next/server').NextRequest,
      createSupervisorSchema
    )

    const result = await createManagedUser({
      actor: admin,
      scope: 'admin-supervisor',
      firstName,
      lastName,
      email,
      universityId,
    })

    const supervisor = await prisma.user.findUnique({
      where: { id: result.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        universityId: true,
        university: { select: { id: true, name: true } },
        _count: { select: { supervisedTeams: true } },
      },
    })

    return jsonOk({ supervisor, emailSent: result.emailSent }, 201)
  } catch (error) {
    return jsonError(error, 'Failed to create supervisor')
  }
}
