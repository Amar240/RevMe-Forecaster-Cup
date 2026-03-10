import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { MessageVisibility } from '@prisma/client'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const { id } = await params

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
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
    })

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    if (authUser.role === 'STUDENT' && ticket.createdById !== authUser.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
    }

    if (
      authUser.role === 'SUPERVISOR' &&
      ticket.createdById !== authUser.id &&
      ticket.supervisorId !== authUser.id &&
      ticket.assignedToId !== authUser.id
    ) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({ ticket })
  } catch (error) {
    logger.error('Failed to fetch ticket:', error)
    return jsonError(error, 'Failed to fetch ticket')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const { id } = await params
    const body = await request.json()
    const { message, action, assignedToId, escalationReason, isInternal, feedbackRating } = body

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
    })

    if (!ticket) {
      return NextResponse.json({ message: 'Ticket not found' }, { status: 404 })
    }

    const isAdmin = authUser.role === 'ADMIN' || authUser.role === 'SUB_ADMIN'
    const isSupervisor = authUser.role === 'SUPERVISOR' && ticket.supervisorId === authUser.id
    const isCreator = ticket.createdById === authUser.id
    const isAssignee = ticket.assignedToId === authUser.id

    if (!isAdmin && !isSupervisor && !isCreator && !isAssignee) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'reply' && message) {
      const visibility = isInternal && (isAdmin || isSupervisor)
        ? MessageVisibility.INTERNAL_ONLY
        : MessageVisibility.STUDENT_VISIBLE

      await prisma.supportTicketReply.create({
        data: {
          ticketId: id,
          authorId: authUser.id,
          message,
          visibility,
        },
      })

      const updateData: Record<string, unknown> = {}
      if (isSupervisor) {
        updateData.status = 'WAITING_ON_STUDENT'
        updateData.supervisorLastResponseAt = new Date()
      } else if (isCreator && authUser.role === 'STUDENT') {
        updateData.status = 'WAITING_ON_SUPERVISOR'
      } else if (isAdmin) {
        updateData.status = 'WAITING_ON_STUDENT'
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.supportTicket.update({
          where: { id },
          data: updateData,
        })
      }

      return NextResponse.json({ message: 'Reply added' })
    }

    if (action === 'internal-note' && message && (isSupervisor || isAdmin)) {
      await prisma.supportTicketReply.create({
        data: {
          ticketId: id,
          authorId: authUser.id,
          message,
          visibility: MessageVisibility.INTERNAL_ONLY,
        },
      })
      return NextResponse.json({ message: 'Internal note added' })
    }

    if (action === 'escalate' && isSupervisor) {
      if (!escalationReason) {
        return NextResponse.json({ message: 'Escalation reason is required' }, { status: 400 })
      }

      await prisma.supportTicket.update({
        where: { id },
        data: {
          status: 'ESCALATED',
          escalatedAt: new Date(),
          escalatedById: authUser.id,
          escalationReason,
        },
      })

      return NextResponse.json({ message: 'Ticket escalated to admin' })
    }

    if (action === 'assign' && assignedToId && isAdmin) {
      await prisma.supportTicket.update({
        where: { id },
        data: { assignedToId },
      })
      return NextResponse.json({ message: 'Ticket assigned' })
    }

    if (action === 'resolve' && (isSupervisor || isAdmin)) {
      await prisma.supportTicket.update({
        where: { id },
        data: { status: 'RESOLVED' },
      })
      return NextResponse.json({ message: 'Ticket resolved' })
    }

    if (action === 'reopen' && isCreator && ticket.status === 'RESOLVED') {
      await prisma.supportTicket.update({
        where: { id },
        data: { status: ticket.supervisorId ? 'WAITING_ON_SUPERVISOR' : 'ESCALATED' },
      })
      return NextResponse.json({ message: 'Ticket reopened' })
    }

    if (action === 'feedback' && isCreator && ticket.status === 'RESOLVED' && typeof feedbackRating === 'boolean') {
      await prisma.supportTicket.update({
        where: { id },
        data: {
          feedbackRating,
          feedbackSubmittedAt: new Date(),
        },
      })
      return NextResponse.json({ message: 'Feedback submitted' })
    }

    return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
  } catch (error) {
    logger.error('Failed to update ticket:', error)
    return jsonError(error, 'Failed to update ticket')
  }
}


