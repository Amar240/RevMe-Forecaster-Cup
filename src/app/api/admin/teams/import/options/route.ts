import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'
import { isImportAssistEnabled } from '@/server/import-assist'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const [seasons, universities, supervisors, supervisorTeams] = await Promise.all([prisma.season.findMany({
      where: {
        status: {
          not: 'COMPLETED',
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        importAssistMode: true,
        startDate: true,
        endDate: true,
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    }), prisma.university.findMany({
      where: { isListed: true },
      select: { id: true, name: true, country: true },
      orderBy: { name: 'asc' },
    }), prisma.user.findMany({
      where: { role: 'SUPERVISOR', isActive: true, universityId: { not: null } },
      select: { id: true, firstName: true, lastName: true, email: true, universityId: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }), prisma.team.groupBy({
      by: ['supervisorId', 'seasonId'],
      where: { supervisorId: { not: null }, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE'] }, season: { status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] } } },
      _count: { _all: true },
    })])

    return jsonOk({ assistInfrastructureAvailable: isImportAssistEnabled(), seasons, universities, supervisors: supervisors.map((supervisor) => ({
      ...supervisor,
      teamCount: supervisorTeams.filter((entry) => entry.supervisorId === supervisor.id).reduce((sum, entry) => sum + entry._count._all, 0),
      teamCountsBySeason: Object.fromEntries(supervisorTeams.filter((entry) => entry.supervisorId === supervisor.id && entry.seasonId).map((entry) => [entry.seasonId as string, entry._count._all])),
    })) })
  } catch (error) {
    return jsonError(error, 'Failed to load import options')
  }
}
