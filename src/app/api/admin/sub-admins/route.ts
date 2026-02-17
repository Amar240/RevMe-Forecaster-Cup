import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const subAdmins = await prisma.user.findMany({
      where: { role: 'SUB_ADMIN' },
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
      orderBy: { createdAt: 'desc' },
    })

    const allPermissions = await prisma.permission.findMany({
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ subAdmins, allPermissions })
  } catch (error) {
    console.error('Failed to fetch sub-admins:', error)
    return NextResponse.json({ message: 'Failed to fetch sub-admins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, firstName, lastName, password, permissions, hasFullAccess } = body

    if (!email || !firstName || !lastName || !password) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json({ message: 'Email already in use' }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const subAdmin = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        firstName,
        lastName,
        passwordHash,
        role: 'SUB_ADMIN',
        emailVerified: true,
        hasFullAccess: hasFullAccess || false,
      },
    })

    if (!hasFullAccess && permissions && permissions.length > 0) {
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
            userId: subAdmin.id,
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
        action: 'SUB_ADMIN_CREATED',
        entityType: 'User',
        entityId: subAdmin.id,
        details: { email: subAdmin.email, permissions, hasFullAccess },
      },
    })

    return NextResponse.json({ subAdmin })
  } catch (error) {
    console.error('Failed to create sub-admin:', error)
    return NextResponse.json({ message: 'Failed to create sub-admin' }, { status: 500 })
  }
}
