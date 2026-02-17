import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const setSubmitterSchema = z.object({
  memberId: z.string(),
})

export async function PATCH(
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
    const data = setSubmitterSchema.parse(body)

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

    const member = team.members.find((m) => m.id === data.memberId)
    if (!member) {
      return NextResponse.json({ message: 'Member not found' }, { status: 404 })
    }

    await prisma.$transaction([
      prisma.teamMember.updateMany({
        where: { teamId: team.id },
        data: { isSubmitter: false },
      }),
      prisma.teamMember.update({
        where: { id: data.memberId },
        data: { isSubmitter: true },
      }),
    ])

    return NextResponse.json({ message: 'Submitter updated' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
    }
    console.error('Set submitter error:', error)
    return NextResponse.json({ message: 'Failed to set submitter' }, { status: 500 })
  }
}
