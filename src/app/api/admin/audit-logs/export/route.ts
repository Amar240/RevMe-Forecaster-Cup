import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    const { response } = await requireAdminOrResponse('audit:view')
    if (response) return response

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
    })

    const userIds = Array.from(new Set(logs.map((l) => l.userId).filter((id): id is string => id !== null)))
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    const headers = [
      'Timestamp',
      'Action',
      'Entity Type',
      'Entity ID',
      'User ID',
      'User Name',
      'User Email',
      'IP Address',
      'Details',
    ]

    const rows = logs.map((log) => {
      const logUser = log.userId ? userMap.get(log.userId) : null
      return [
        log.createdAt.toISOString(),
        log.action,
        log.entityType,
        log.entityId || '',
        log.userId || '',
        logUser ? `${logUser.firstName} ${logUser.lastName}` : '',
        logUser?.email || '',
        log.ipAddress || '',
        log.details ? JSON.stringify(log.details) : '',
      ]
    })

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="revme_audit-logs_${stamp}.csv"`,
      },
    })
  } catch (error) {
    return jsonError(error, 'Failed to export audit logs')
  }
}
