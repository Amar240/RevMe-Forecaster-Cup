import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function GET() {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const teams = await prisma.team.findMany({
      where: user.role === 'ADMIN' ? {} : { supervisorId: user.id },
      include: {
        university: true,
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

export async function POST(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createTeamSchema.parse(body)

    const existingTeamWithName = await prisma.team.findFirst({
      where: { name: { equals: data.name, mode: 'insensitive' } },
    })

    if (existingTeamWithName) {
      return NextResponse.json(
        { message: 'A team with this name already exists. Please choose a different name.' },
        { status: 422 }
      )
    }

    const teamCount = await prisma.team.count({
      where: { supervisorId: user.id },
    })

    if (teamCount >= 10) {
      return NextResponse.json(
        { message: 'Maximum 10 teams per supervisor' },
        { status: 422 }
      )
    }

    if (!user.universityId) {
      return NextResponse.json(
        { message: 'User must be associated with a university' },
        { status: 422 }
      )
    }

    const university = await prisma.university.findUnique({
      where: { id: user.universityId },
    })

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!activeSeason) {
      return NextResponse.json(
        { message: 'No active season for team registration' },
        { status: 422 }
      )
    }

    const existingTeamsCount = await prisma.team.count({
      where: { universityId: user.universityId },
    })

    const displayId = `${university?.name || 'Team'}${existingTeamsCount + 1}`

    const team = await prisma.team.create({
      data: {
        name: data.name,
        displayId,
        supervisorId: user.id,
        universityId: user.universityId,
        seasonId: activeSeason.id,
      },
      include: {
        university: true,
        members: true,
      },
    })

    return NextResponse.json({ team }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input' }, { status: 400 })
    }
    console.error('Create team error:', error)
    return NextResponse.json({ message: 'Failed to create team' }, { status: 500 })
  }
}
