import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const requests = await prisma.joinRequest.findMany({
      where: { studentId: user.id },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
        season: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Failed to fetch join requests:', error)
    return NextResponse.json({ message: 'Failed to fetch join requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'STUDENT') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { supervisorEmail, message } = body

    if (!supervisorEmail) {
      return NextResponse.json({ message: 'Supervisor email is required' }, { status: 400 })
    }

    const existingMembership = await prisma.teamMember.findFirst({
      where: { userId: user.id },
    })

    if (existingMembership) {
      return NextResponse.json({ message: 'You are already a member of a team' }, { status: 400 })
    }

    const pendingRequest = await prisma.joinRequest.findFirst({
      where: { studentId: user.id, status: 'PENDING' },
    })

    if (pendingRequest) {
      return NextResponse.json({ message: 'You already have a pending join request' }, { status: 400 })
    }

    const supervisor = await prisma.user.findFirst({
      where: { email: supervisorEmail.toLowerCase(), role: 'SUPERVISOR' },
    })

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    const joinRequest = await prisma.joinRequest.create({
      data: {
        studentId: user.id,
        supervisorId: supervisor?.id || null,
        supervisorEmailEntered: supervisorEmail.toLowerCase(),
        seasonId: activeSeason?.id || null,
        message: message || null,
        status: 'PENDING',
      },
      include: {
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return NextResponse.json({ request: joinRequest })
  } catch (error) {
    console.error('Failed to create join request:', error)
    return NextResponse.json({ message: 'Failed to create join request' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('id')

    if (!requestId) {
      return NextResponse.json({ message: 'Request ID is required' }, { status: 400 })
    }

    const joinRequest = await prisma.joinRequest.findUnique({
      where: { id: requestId },
    })

    if (!joinRequest || joinRequest.studentId !== user.id) {
      return NextResponse.json({ message: 'Join request not found' }, { status: 404 })
    }

    if (joinRequest.status !== 'PENDING') {
      return NextResponse.json({ message: 'Only pending requests can be canceled' }, { status: 400 })
    }

    await prisma.joinRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELED' },
    })

    return NextResponse.json({ message: 'Request canceled' })
  } catch (error) {
    console.error('Failed to cancel join request:', error)
    return NextResponse.json({ message: 'Failed to cancel join request' }, { status: 500 })
  }
}
