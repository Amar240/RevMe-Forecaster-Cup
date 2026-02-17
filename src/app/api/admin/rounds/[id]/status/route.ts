import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { logAuditAction } from '@/lib/audit'
import type { RoundStatus } from '@prisma/client'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, opensAt, closesAt } = body

    if (!['UPCOMING', 'OPEN', 'PAUSED', 'CLOSED'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status' }, { status: 400 })
    }

    const round = await prisma.round.findUnique({
      where: { id },
      include: { season: true },
    })

    if (!round) {
      return NextResponse.json({ message: 'Round not found' }, { status: 404 })
    }

    if (status === 'OPEN') {
      if (round.season.status !== 'ACTIVE') {
        return NextResponse.json(
          { 
            message: `Cannot open Round ${round.number}. Season must be ACTIVE first (current: ${round.season.status}).`,
            code: 'SEASON_NOT_ACTIVE'
          },
          { status: 422 }
        )
      }

      const existingOpenRound = await prisma.round.findFirst({
        where: {
          seasonId: round.seasonId,
          status: 'OPEN',
          id: { not: id },
        },
      })

      if (existingOpenRound) {
        return NextResponse.json(
          { 
            message: `Cannot open Round ${round.number}. Round ${existingOpenRound.number} is already open. Close it first.`,
            code: 'MAX_ONE_OPEN_ROUND'
          },
          { status: 422 }
        )
      }

      const finalOpensAt = opensAt ? new Date(opensAt) : round.opensAt
      const finalClosesAt = closesAt ? new Date(closesAt) : round.closesAt
      if (finalOpensAt >= finalClosesAt) {
        return NextResponse.json(
          { 
            message: 'Opens At must be before Closes At',
            code: 'INVALID_DATE_RANGE'
          },
          { status: 422 }
        )
      }
    }

    const previousStatus = round.status
    const previousOpensAt = round.opensAt
    const previousClosesAt = round.closesAt

    const updateData: { status: RoundStatus; opensAt?: Date; closesAt?: Date } = { status: status as RoundStatus }
    if (opensAt) updateData.opensAt = new Date(opensAt)
    if (closesAt) updateData.closesAt = new Date(closesAt)

    const updatedRound = await prisma.round.update({
      where: { id },
      data: updateData,
    })

    await logAuditAction(user.id, 'UPDATE_ROUND_STATUS', 'Round', id, {
      roundNumber: round.number,
      previousStatus,
      newStatus: status,
      previousOpensAt: previousOpensAt?.toISOString(),
      previousClosesAt: previousClosesAt?.toISOString(),
      newOpensAt: opensAt || undefined,
      newClosesAt: closesAt || undefined,
    }, null)

    return NextResponse.json({ 
      message: `Round ${round.number} status updated to ${status}`,
      round: updatedRound 
    })
  } catch (error) {
    console.error('Update round status error:', error)
    return NextResponse.json({ message: 'Failed to update round status' }, { status: 500 })
  }
}
