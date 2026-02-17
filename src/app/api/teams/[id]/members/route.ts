import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const addMemberSchema = z.object({
  email: z.string().email(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const data = addMemberSchema.parse(body)

    const team = await prisma.team.findUnique({
      where: { id },
      include: { members: true },
    })

    if (!team) {
      return NextResponse.json({ message: 'Team not found' }, { status: 404 })
    }

    if (user.role !== 'ADMIN' && team.supervisorId !== user.id) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    if (team.members.length >= 5) {
      return NextResponse.json(
        { message: 'Maximum 5 students per team' },
        { status: 422 }
      )
    }

    const student = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (!student) {
      return NextResponse.json(
        { message: 'Student not found. They must register first.' },
        { status: 404 }
      )
    }

    if (student.role !== 'STUDENT') {
      return NextResponse.json(
        { message: 'User is not a student' },
        { status: 422 }
      )
    }

    const existingMembership = await prisma.teamMember.findFirst({
      where: { userId: student.id },
    })

    if (existingMembership) {
      return NextResponse.json(
        { message: 'Student is already on a team' },
        { status: 409 }
      )
    }

    const isFirstMember = team.members.length === 0

    const member = await prisma.teamMember.create({
      data: {
        userId: student.id,
        teamId: team.id,
        isSubmitter: isFirstMember,
      },
      include: { user: true },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
    }
    console.error('Add member error:', error)
    return NextResponse.json({ message: 'Failed to add member' }, { status: 500 })
  }
}
