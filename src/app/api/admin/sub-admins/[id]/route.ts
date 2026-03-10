import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const subAdmin = await prisma.user.findUnique({
      where: { id, role: 'SUB_ADMIN' },
      select: {
        id: true, email: true, firstName: true, lastName: true, hasFullAccess: true, createdAt: true,
        permissions: { include: { permission: true } },
      },
    })

    if (!subAdmin) throw new ApiError('Sub-admin not found', 404, 'NOT_FOUND')
    return jsonOk({ subAdmin })
  } catch (error) {
    return jsonError(error, 'Failed to fetch sub-admin')
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await request.json()
    const { permissions, firstName, lastName, hasFullAccess } = body

    const subAdmin = await prisma.user.findUnique({ where: { id, role: 'SUB_ADMIN' } })
    if (!subAdmin) throw new ApiError('Sub-admin not found', 404, 'NOT_FOUND')

    if (firstName || lastName || hasFullAccess !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { ...(firstName && { firstName }), ...(lastName && { lastName }), ...(hasFullAccess !== undefined && { hasFullAccess }) },
      })
    }

    if (hasFullAccess === true) {
      await prisma.userPermission.deleteMany({ where: { userId: id } })
    } else if (permissions !== undefined) {
      await prisma.userPermission.deleteMany({ where: { userId: id } })
      for (const permName of permissions) {
        let permission = await prisma.permission.findUnique({ where: { name: permName } })
        if (!permission) permission = await prisma.permission.create({ data: { name: permName } })
        await prisma.userPermission.create({ data: { userId: id, permissionId: permission.id, grantedById: user!.id } })
      }
    }

    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'SUB_ADMIN_UPDATED', entityType: 'User', entityId: id, details: { permissions, hasFullAccess } },
    })

    return jsonOk({ message: 'Sub-admin updated' })
  } catch (error) {
    return jsonError(error, 'Failed to update sub-admin')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const subAdmin = await prisma.user.findUnique({ where: { id, role: 'SUB_ADMIN' } })
    if (!subAdmin) throw new ApiError('Sub-admin not found', 404, 'NOT_FOUND')

    await prisma.user.update({ where: { id }, data: { role: 'STUDENT' } })
    await prisma.userPermission.deleteMany({ where: { userId: id } })

    await prisma.auditLog.create({
      data: { userId: user!.id, userEmail: user!.email, userRole: user!.role, action: 'SUB_ADMIN_REMOVED', entityType: 'User', entityId: id, details: { email: subAdmin.email } },
    })

    return jsonOk({ message: 'Sub-admin removed' })
  } catch (error) {
    return jsonError(error, 'Failed to remove sub-admin')
  }
}
