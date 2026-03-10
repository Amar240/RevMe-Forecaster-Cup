import { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { jsonOk, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return jsonOk({ hasAccess: false, permissions: [] })
    }

    if (user.role === 'ADMIN') {
      return jsonOk({
        hasAccess: true,
        isAdmin: true,
        hasFullAccess: true,
        permissions: ['all'],
      })
    }

    if (user.role === 'SUB_ADMIN') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { hasFullAccess: true },
      })

      if (fullUser?.hasFullAccess) {
        return jsonOk({
          hasAccess: true,
          isAdmin: false,
          hasFullAccess: true,
          permissions: ['all'],
        })
      }

      const userPermissions = await prisma.userPermission.findMany({
        where: { userId: user.id },
        include: { permission: true },
      })

      return jsonOk({
        hasAccess: true,
        isAdmin: false,
        hasFullAccess: false,
        permissions: userPermissions.map((up) => up.permission.name),
      })
    }

    return jsonOk({ hasAccess: false, permissions: [] })
  } catch (error) {
    return jsonError(error, 'Failed to get permissions')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return jsonOk({ allowed: false })
    }

    const { permission } = await request.json()

    if (user.role === 'ADMIN') {
      return jsonOk({ allowed: true })
    }

    if (user.role === 'SUB_ADMIN') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { hasFullAccess: true },
      })

      if (fullUser?.hasFullAccess) {
        return jsonOk({ allowed: true })
      }

      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId: user.id,
          permission: { name: permission },
        },
      })

      return jsonOk({ allowed: !!userPermission })
    }

    return jsonOk({ allowed: false })
  } catch (error) {
    return jsonError(error, 'Failed to check permission')
  }
}
