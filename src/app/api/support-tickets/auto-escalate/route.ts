import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'

export const dynamic = 'force-dynamic'


const AUTO_ESCALATION_HOURS = 48

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    if (authUser.role !== 'ADMIN' && authUser.role !== 'SUB_ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - AUTO_ESCALATION_HOURS)

    const ticketsToEscalate = await prisma.supportTicket.findMany({
      where: {
        status: 'WAITING_ON_SUPERVISOR',
        supervisorId: { not: null },
        OR: [
          { supervisorLastResponseAt: null, createdAt: { lt: cutoffDate } },
          { supervisorLastResponseAt: { lt: cutoffDate } },
        ],
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        supervisor: { select: { firstName: true, lastName: true, email: true } },
      },
    })

    const escalatedIds: string[] = []

    for (const ticket of ticketsToEscalate) {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: {
          status: 'ESCALATED',
          autoEscalatedAt: new Date(),
          escalationReason: `Auto-escalated: No supervisor response for ${AUTO_ESCALATION_HOURS} hours`,
        },
      })
      escalatedIds.push(ticket.id)
    }

    return NextResponse.json({
      message: `Auto-escalated ${escalatedIds.length} tickets`,
      escalatedTicketIds: escalatedIds,
    })
  } catch (error) {
    logger.error('Failed to auto-escalate tickets:', error)
    return jsonError(error, 'Failed to auto-escalate tickets')
  }
}

export async function GET() {
  try {
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - AUTO_ESCALATION_HOURS)

    const ticketsDue = await prisma.supportTicket.count({
      where: {
        status: 'WAITING_ON_SUPERVISOR',
        supervisorId: { not: null },
        OR: [
          { supervisorLastResponseAt: null, createdAt: { lt: cutoffDate } },
          { supervisorLastResponseAt: { lt: cutoffDate } },
        ],
      },
    })

    return NextResponse.json({
      ticketsDueForEscalation: ticketsDue,
      escalationThresholdHours: AUTO_ESCALATION_HOURS,
    })
  } catch (error) {
    logger.error('Failed to check auto-escalation status:', error)
    return jsonError(error, 'Failed to check auto-escalation status')
  }
}


