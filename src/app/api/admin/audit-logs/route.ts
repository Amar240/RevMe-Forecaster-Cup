import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { canPerformAdminAction } from '@/server/permissions'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'

export async function GET(request: Request) {
  try {
    const user = await getSession()
    const canView = await canPerformAdminAction(user, 'audit:view')

    if (!user || !canView) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(200, Math.max(20, parseInt(searchParams.get('pageSize') || '50', 10)))
    const skip = (page - 1) * pageSize

    const [logs, totalLogs] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
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

    return NextResponse.json({ logs: formattedLogs, totalLogs, page, pageSize })
  } catch (error) {
    logger.error('Audit logs fetch error:', error)
    return jsonError(error, 'Failed to fetch audit logs')
  }
}
