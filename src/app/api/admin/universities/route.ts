import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const universitySchema = z.object({
  name: z.string().min(1),
  country: z.string().optional(),
})

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const universities = await prisma.university.findMany({
      include: {
        _count: { select: { users: true, teams: true } },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ universities })
  } catch (error) {
    console.error('Get universities error:', error)
    return NextResponse.json({ message: 'Failed to get universities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = universitySchema.parse(body)

    const existing = await prisma.university.findUnique({
      where: { name: data.name },
    })

    if (existing) {
      return NextResponse.json(
        { message: 'University already exists' },
        { status: 409 }
      )
    }

    const university = await prisma.university.create({
      data: {
        name: data.name,
        country: data.country || null,
      },
    })

    return NextResponse.json({ university }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
    }
    console.error('Create university error:', error)
    return NextResponse.json({ message: 'Failed to create university' }, { status: 500 })
  }
}
