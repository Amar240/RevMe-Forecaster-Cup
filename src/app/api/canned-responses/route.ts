import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const whereClause: Record<string, unknown> = {
      OR: [
        { createdById: user.id },
        { isGlobal: true },
      ],
    }

    if (category && category !== 'all') {
      whereClause.category = category
    }

    const responses = await prisma.cannedResponse.findMany({
      where: whereClause,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [
        { usageCount: 'desc' },
        { title: 'asc' },
      ],
    })

    return NextResponse.json({ responses })
  } catch (error) {
    console.error('Failed to fetch canned responses:', error)
    return NextResponse.json({ message: 'Failed to fetch canned responses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN' && user.role !== 'SUB_ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, category, isGlobal } = body

    if (!title || !content) {
      return NextResponse.json({ message: 'Title and content are required' }, { status: 400 })
    }

    const response = await prisma.cannedResponse.create({
      data: {
        title,
        content,
        category: category || 'GENERAL',
        createdById: user.id,
        isGlobal: user.role === 'ADMIN' ? (isGlobal ?? false) : false,
      },
    })

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Failed to create canned response:', error)
    return NextResponse.json({ message: 'Failed to create canned response' }, { status: 500 })
  }
}
