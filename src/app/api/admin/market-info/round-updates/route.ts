import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { seasonId, marketId, roundNumber, headline, whatChanged } = body

    if (!seasonId || !marketId || roundNumber === undefined || !headline || !whatChanged) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 })
    }

    const roundUpdate = await prisma.marketRoundUpdate.upsert({
      where: {
        seasonId_marketId_roundNumber: { seasonId, marketId, roundNumber },
      },
      create: {
        seasonId,
        marketId,
        roundNumber,
        headline,
        whatChanged,
        createdById: user.id,
      },
      update: {
        headline,
        whatChanged,
      },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UPDATE_MARKET_ROUND_UPDATE',
        entityType: 'MarketRoundUpdate',
        entityId: roundUpdate.id,
        details: { marketId, roundNumber, headline },
      },
    })

    return NextResponse.json({ roundUpdate })
  } catch (error) {
    console.error('Save round update error:', error)
    return NextResponse.json({ message: 'Failed to save round update' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ message: 'ID is required' }, { status: 400 })
    }

    const roundUpdate = await prisma.marketRoundUpdate.delete({
      where: { id },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'DELETE_MARKET_ROUND_UPDATE',
        entityType: 'MarketRoundUpdate',
        entityId: id,
        details: { headline: roundUpdate.headline, roundNumber: roundUpdate.roundNumber },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete round update error:', error)
    return NextResponse.json({ message: 'Failed to delete round update' }, { status: 500 })
  }
}
