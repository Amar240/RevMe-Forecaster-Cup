import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const lockSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const round = await prisma.round.findUnique({
      where: { id },
    })

    if (!round) {
      return NextResponse.json({ message: 'Round not found' }, { status: 404 })
    }

    if (round.isLockedActuals) {
      return NextResponse.json({ message: 'Round actuals are already locked' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.round.update({
        where: { id },
        data: {
          isLockedActuals: true,
          lockedAt: new Date(),
          lockedById: user.id,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'LOCK_ROUND_ACTUALS',
          entityType: 'Round',
          entityId: id,
          details: { roundNumber: round.number },
        },
      })
    })

    return NextResponse.json({ message: 'Round actuals locked' })
  } catch (error) {
    console.error('Lock round error:', error)
    return NextResponse.json({ message: 'Failed to lock round' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const data = lockSchema.parse(body)

    if (!data.reason || data.reason.trim().length < 5) {
      return NextResponse.json({ 
        message: 'A reason is required to unlock round actuals (minimum 5 characters)',
        requiresReason: true
      }, { status: 400 })
    }

    const round = await prisma.round.findUnique({
      where: { id },
    })

    if (!round) {
      return NextResponse.json({ message: 'Round not found' }, { status: 404 })
    }

    if (!round.isLockedActuals) {
      return NextResponse.json({ message: 'Round actuals are not locked' }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.round.update({
        where: { id },
        data: {
          isLockedActuals: false,
          lockedAt: null,
          lockedById: null,
        },
      })

      await tx.auditLog.create({
        data: {
          userId: user.id,
          userEmail: user.email,
          userRole: user.role,
          action: 'UNLOCK_ROUND_ACTUALS',
          entityType: 'Round',
          entityId: id,
          details: { 
            roundNumber: round.number,
            reason: data.reason,
          },
        },
      })
    })

    return NextResponse.json({ message: 'Round actuals unlocked' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 })
    }
    console.error('Unlock round error:', error)
    return NextResponse.json({ message: 'Failed to unlock round' }, { status: 500 })
  }
}
