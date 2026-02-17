import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { MessageVisibility, TicketCategory } from '@prisma/client'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const view = searchParams.get('view') // 'inbox' for supervisor inbox, 'escalations' for admin

    let whereClause: Record<string, unknown> = {}

    if (authUser.role === 'STUDENT') {
      whereClause = { createdById: authUser.id }
    } else if (authUser.role === 'SUPERVISOR') {
      if (view === 'inbox') {
        whereClause = { supervisorId: authUser.id }
      } else {
        whereClause = { createdById: authUser.id }
      }
    } else if (authUser.role === 'ADMIN' || authUser.role === 'SUB_ADMIN') {
      if (view === 'escalations') {
        whereClause = { status: 'ESCALATED' }
      }
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    const tickets = await prisma.supportTicket.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        escalatedBy: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
          orderBy: { createdAt: 'asc' },
          where: authUser.role === 'STUDENT' ? { visibility: MessageVisibility.STUDENT_VISIBLE } : undefined,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ tickets })
  } catch (error) {
    logger.error('Failed to fetch tickets:', error)
    return jsonError(error, 'Failed to fetch tickets')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const body = await request.json()
    const { category, subject, message } = body as { category?: string; subject?: string; message?: string }

    if (!subject || !message) {
      return NextResponse.json({ message: 'Subject and message are required' }, { status: 400 })
    }

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    let supervisorId: string | null = null
    let teamId: string | null = null
    let ticketCategory: TicketCategory = (category as TicketCategory) || 'GENERAL'
    let initialStatus: 'OPEN' | 'WAITING_ON_SUPERVISOR' | 'ESCALATED' = 'OPEN'

    if (authUser.role === 'STUDENT') {
      const teamMembership = await prisma.teamMember.findFirst({
        where: { userId: authUser.id },
        include: {
          team: {
            include: {
              supervisor: true,
            },
          },
        },
      })

      if (!teamMembership?.team) {
        return NextResponse.json(
          { message: 'You must be on a team to contact support. Please request to join a supervisor first.' },
          { status: 422 }
        )
      }

      teamId = teamMembership.team.id
      supervisorId = teamMembership.team.supervisorId
      initialStatus = 'WAITING_ON_SUPERVISOR'
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        createdById: authUser.id,
        seasonId: activeSeason?.id || null,
        teamId,
        supervisorId,
        category: ticketCategory,
        subject,
        message,
        status: initialStatus,
        escalatedAt: null,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        supervisor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })

    return NextResponse.json({ ticket })
  } catch (error) {
    logger.error('Failed to create ticket:', error)
    return jsonError(error, 'Failed to create ticket')
  }
}
