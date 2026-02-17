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
    const { marketInfoId, label, url, type, note } = body

    if (!marketInfoId || !label || !url) {
      return NextResponse.json({ message: 'marketInfoId, label, and url are required' }, { status: 400 })
    }

    const maxOrder = await prisma.marketResourceLink.aggregate({
      where: { marketInfoId },
      _max: { order: true },
    })

    const link = await prisma.marketResourceLink.create({
      data: {
        marketInfoId,
        label,
        url,
        type: type || 'OTHER',
        note,
        order: (maxOrder._max.order || 0) + 1,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'CREATE_MARKET_LINK',
        entityType: 'MarketResourceLink',
        entityId: link.id,
        details: { label, url, type },
      },
    })

    return NextResponse.json({ link })
  } catch (error) {
    console.error('Create market link error:', error)
    return NextResponse.json({ message: 'Failed to create link' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, label, url, type, note, order } = body

    if (!id) {
      return NextResponse.json({ message: 'Link ID is required' }, { status: 400 })
    }

    const link = await prisma.marketResourceLink.update({
      where: { id },
      data: {
        ...(label && { label }),
        ...(url && { url }),
        ...(type && { type }),
        ...(note !== undefined && { note }),
        ...(order !== undefined && { order }),
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'UPDATE_MARKET_LINK',
        entityType: 'MarketResourceLink',
        entityId: link.id,
        details: { label, url, type },
      },
    })

    return NextResponse.json({ link })
  } catch (error) {
    console.error('Update market link error:', error)
    return NextResponse.json({ message: 'Failed to update link' }, { status: 500 })
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
      return NextResponse.json({ message: 'Link ID is required' }, { status: 400 })
    }

    const link = await prisma.marketResourceLink.delete({
      where: { id },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'DELETE_MARKET_LINK',
        entityType: 'MarketResourceLink',
        entityId: id,
        details: { label: link.label },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete market link error:', error)
    return NextResponse.json({ message: 'Failed to delete link' }, { status: 500 })
  }
}
