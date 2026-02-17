import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const subAdmin = await prisma.user.findUnique({
      where: { id, role: 'SUB_ADMIN' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        hasFullAccess: true,
        createdAt: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!subAdmin) {
      return NextResponse.json({ message: 'Sub-admin not found' }, { status: 404 })
    }

    return NextResponse.json({ subAdmin })
  } catch (error) {
    console.error('Failed to fetch sub-admin:', error)
    return NextResponse.json({ message: 'Failed to fetch sub-admin' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { permissions, firstName, lastName, hasFullAccess } = body

    const subAdmin = await prisma.user.findUnique({
      where: { id, role: 'SUB_ADMIN' },
    })

    if (!subAdmin) {
      return NextResponse.json({ message: 'Sub-admin not found' }, { status: 404 })
    }

    if (firstName || lastName || hasFullAccess !== undefined) {
      await prisma.user.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(hasFullAccess !== undefined && { hasFullAccess }),
        },
      })
    }

    if (hasFullAccess === true) {
      await prisma.userPermission.deleteMany({
        where: { userId: id },
      })
    } else if (permissions !== undefined) {
      await prisma.userPermission.deleteMany({
        where: { userId: id },
      })

      for (const permName of permissions) {
        let permission = await prisma.permission.findUnique({
          where: { name: permName },
        })

        if (!permission) {
          permission = await prisma.permission.create({
            data: { name: permName },
          })
        }

        await prisma.userPermission.create({
          data: {
            userId: id,
            permissionId: permission.id,
            grantedById: user.id,
          },
        })
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'SUB_ADMIN_UPDATED',
        entityType: 'User',
        entityId: id,
        details: { permissions, hasFullAccess },
      },
    })

    return NextResponse.json({ message: 'Sub-admin updated' })
  } catch (error) {
    console.error('Failed to update sub-admin:', error)
    return NextResponse.json({ message: 'Failed to update sub-admin' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const subAdmin = await prisma.user.findUnique({
      where: { id, role: 'SUB_ADMIN' },
    })

    if (!subAdmin) {
      return NextResponse.json({ message: 'Sub-admin not found' }, { status: 404 })
    }

    await prisma.user.update({
      where: { id },
      data: { role: 'STUDENT' },
    })

    await prisma.userPermission.deleteMany({
      where: { userId: id },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'SUB_ADMIN_REMOVED',
        entityType: 'User',
        entityId: id,
        details: { email: subAdmin.email },
      },
    })

    return NextResponse.json({ message: 'Sub-admin removed' })
  } catch (error) {
    console.error('Failed to remove sub-admin:', error)
    return NextResponse.json({ message: 'Failed to remove sub-admin' }, { status: 500 })
  }
}
