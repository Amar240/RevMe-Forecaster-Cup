import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    const { response } = await requireAdminOrResponse('audit:view')
    if (response) return response

    const { searchParams } = new URL(request.url)
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')
    const usePagination = pageParam !== null && pageSizeParam !== null

    const page = usePagination ? Math.max(1, parseInt(pageParam, 10)) : 1
    const pageSize = usePagination ? Math.min(200, Math.max(20, parseInt(pageSizeParam, 10))) : undefined

    const [logs, totalLogs] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        ...(usePagination ? { skip: (page - 1) * pageSize!, take: pageSize } : {}),
      }),
      prisma.auditLog.count(),
    ])

    const userIds = Array.from(new Set(logs.map((l) => l.userId).filter((id): id is string => id !== null)))
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    const formattedLogs = logs.map((log) => {
      const logUser = log.userId ? userMap.get(log.userId) : null
      return {
        id: log.id,
        userId: log.userId,
        userName: logUser ? `${logUser.firstName} ${logUser.lastName}` : null,
        userEmail: logUser?.email || null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        details: log.details as Record<string, unknown> | null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      }
    })

    return jsonOk({ logs: formattedLogs, totalLogs, page, pageSize })
  } catch (error) {
    return jsonError(error, 'Failed to fetch audit logs')
  }
}
