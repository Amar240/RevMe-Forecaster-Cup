import type { TeamsResponse } from '@/features/teams/types'
import { prisma } from '@/server/db'
import { ApiError, requireUser } from '@/server/http'

export async function getTeamsForUser(): Promise<TeamsResponse> {
  const user = await requireUser()
  if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN') {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }

  const teams = await prisma.team.findMany({
    where: user.role === 'ADMIN' ? {} : { supervisorId: user.id },
    include: {
      university: true,
      supervisor: true,
      members: {
        include: { user: true },
      },
      _count: {
        select: { submissions: true, warnings: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return { teams }
}
