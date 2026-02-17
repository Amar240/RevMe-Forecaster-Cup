import { prisma } from '@/server/db'
import { canPerformAdminAction } from '@/server/permissions'
import { ApiError } from '@/server/http'
import type { User } from '@prisma/client'
import type { ListUsersQuery } from '@/features/users/schema'

export async function listUsers(user: User | null, query: ListUsersQuery) {
  const canManage = await canPerformAdminAction(user, 'users:manage')
  if (!canManage) {
    throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED')
  }

  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 50
  const skip = (page - 1) * pageSize

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      include: {
        university: true,
        teamMemberships: { include: { team: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count(),
  ])

  return { users, total, page, pageSize }
}
