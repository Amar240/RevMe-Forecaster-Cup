import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
})

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        university: true,
        teamMemberships: {
          include: {
            team: {
              include: { supervisor: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ user: fullUser })
  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json({ message: 'Failed to get user' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = updateProfileSchema.parse(body)

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
      },
    })

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
    }
    console.error('Update profile error:', error)
    return NextResponse.json({ message: 'Failed to update profile' }, { status: 500 })
  }
}
