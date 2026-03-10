import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const subAdmins = await prisma.user.findMany({
      where: { role: 'SUB_ADMIN' },
      select: {
        id: true, email: true, firstName: true, lastName: true, hasFullAccess: true, createdAt: true,
        permissions: { include: { permission: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const allPermissions = await prisma.permission.findMany({ orderBy: { name: 'asc' } })
    return jsonOk({ subAdmins, allPermissions })
  } catch (error) {
    return jsonError(error, 'Failed to fetch sub-admins')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await request.json()
    const { email, firstName, lastName, password, permissions, hasFullAccess } = body

    if (!email || !firstName || !lastName || !password) {
      throw new ApiError('All fields are required', 400, 'INVALID_INPUT')
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existingUser) throw new ApiError('Email already in use', 400, 'DUPLICATE')

    const passwordHash = await bcrypt.hash(password, 10)
    const subAdmin = await prisma.user.create({
      data: { email: email.toLowerCase(), firstName, lastName, passwordHash, role: 'SUB_ADMIN', emailVerified: true, hasFullAccess: hasFullAccess || false },
    })

    if (!hasFullAccess && permissions && permissions.length > 0) {
      for (const permName of permissions) {
        let permission = await prisma.permission.findUnique({ where: { name: permName } })
        if (!permission) permission = await prisma.permission.create({ data: { name: permName } })
        await prisma.userPermission.create({ data: { userId: subAdmin.id, permissionId: permission.id, grantedById: user!.id } })
      }
    }

    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'SUB_ADMIN_CREATED', entityType: 'User', entityId: subAdmin.id, details: { email: subAdmin.email, permissions, hasFullAccess } },
    })

    return jsonOk({ subAdmin })
  } catch (error) {
    return jsonError(error, 'Failed to create sub-admin')
  }
}
