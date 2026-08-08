import { requireAdmin, jsonOk, jsonError, parseJson } from '@/server/http'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createManagedUser } from '@/server/user-management'
import { isCurrentSupervisorResponsibility } from '@/server/team-supervisor-assignment'

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
        supervisedTeams: {
          select: {
            id: true,
            status: true,
            seasonId: true,
            season: { select: { status: true } },
          },
        },
        teamSupervisorAssignments: {
          select: {
            team: {
              select: {
                id: true,
                status: true,
                seasonId: true,
                season: { select: { status: true } },
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })

    return jsonOk({
      supervisors: supervisors.map(({ teamSupervisorAssignments, supervisedTeams, ...supervisor }) => {
        const currentTeamIds = new Set(
          supervisedTeams.filter(isCurrentSupervisorResponsibility).map((team) => team.id)
        )
        const historicalTeamIds = new Set([
          ...supervisedTeams.filter((team) => !currentTeamIds.has(team.id)).map((team) => team.id),
          ...teamSupervisorAssignments
            .filter((assignment) => !currentTeamIds.has(assignment.team.id))
            .map((assignment) => assignment.team.id),
        ])
        return {
          ...supervisor,
          _count: {
            ...supervisor._count,
            currentTeams: currentTeamIds.size,
            historicalTeams: historicalTeamIds.size,
          },
        }
      }),
    })
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

    return jsonOk(
      {
        supervisor,
        emailSent: result.emailSent,
        devPassword: result.devPassword ?? null,
      },
      201
    )
  } catch (error) {
    return jsonError(error, 'Failed to create supervisor')
  }
}
