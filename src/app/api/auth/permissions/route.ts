import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ hasAccess: false, permissions: [] })
    }

    if (user.role === 'ADMIN') {
      return NextResponse.json({ 
        hasAccess: true, 
        isAdmin: true,
        hasFullAccess: true,
        permissions: ['all'] 
      })
    }

    if (user.role === 'SUB_ADMIN') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { hasFullAccess: true },
      })

      if (fullUser?.hasFullAccess) {
        return NextResponse.json({ 
          hasAccess: true, 
          isAdmin: false,
          hasFullAccess: true,
          permissions: ['all'] 
        })
      }

      const userPermissions = await prisma.userPermission.findMany({
        where: { userId: user.id },
        include: { permission: true },
      })

      const permissions = userPermissions.map(up => up.permission.name)

      return NextResponse.json({ 
        hasAccess: true, 
        isAdmin: false,
        hasFullAccess: false,
        permissions 
      })
    }

    return NextResponse.json({ hasAccess: false, permissions: [] })
  } catch (error) {
    console.error('Get permissions error:', error)
    return NextResponse.json({ hasAccess: false, permissions: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ allowed: false })
    }

    const { permission } = await request.json()

    if (user.role === 'ADMIN') {
      return NextResponse.json({ allowed: true })
    }

    if (user.role === 'SUB_ADMIN') {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { hasFullAccess: true },
      })

      if (fullUser?.hasFullAccess) {
        return NextResponse.json({ allowed: true })
      }

      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId: user.id,
          permission: { name: permission },
        },
      })

      return NextResponse.json({ allowed: !!userPermission })
    }

    return NextResponse.json({ allowed: false })
  } catch (error) {
    console.error('Check permission error:', error)
    return NextResponse.json({ allowed: false })
  }
}
