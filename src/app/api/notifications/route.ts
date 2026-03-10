import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const notifications = await prisma.notification.findMany({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: user!.id, read: false },
    })

    return jsonOk({ notifications, unreadCount })
  } catch (error) {
    return jsonError(error, 'Failed to get notifications')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response

    const { notificationId, markAllRead } = await request.json()

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user!.id, read: false },
        data: { read: true },
      })
    } else if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId, userId: user!.id },
        data: { read: true },
      })
    }

    return jsonOk({ success: true })
  } catch (error) {
    return jsonError(error, 'Failed to update notification')
  }
}
