import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const teams = await prisma.team.findMany({
      include: {
        university: true,
        supervisor: true,
        members: { include: { user: true } },
        _count: { select: { submissions: true, warnings: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('Get teams error:', error)
    return NextResponse.json({ message: 'Failed to get teams' }, { status: 500 })
  }
}
