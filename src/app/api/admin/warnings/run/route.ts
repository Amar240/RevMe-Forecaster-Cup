import { NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { logger } from '@/server/logger'
import { getSession } from '@/server/auth'
import { jsonError } from '@/server/http'

export async function POST() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    }

    const now = new Date()

    const closedRounds = await prisma.round.findMany({
      where: { closesAt: { lt: now } },
      include: {
        season: {
          include: {
            markets: { where: { isActive: true } },
          },
        },
      },
    })

    const activeTeams = await prisma.team.findMany({
      where: { status: 'ACTIVE' },
    })

    let warningsCreated = 0

    for (const round of closedRounds) {
      for (const team of activeTeams) {
        const submission = await prisma.submission.findFirst({
          where: { teamId: team.id, roundId: round.id },
          select: { id: true },
        })

        if (!submission) {
          const existingWarning = await prisma.warning.findUnique({
            where: {
              teamId_roundId_type: {
                teamId: team.id,
                roundId: round.id,
                type: 'MISSED_SUBMISSION',
              },
            },
          })

          if (!existingWarning) {
            await prisma.warning.create({
              data: {
                teamId: team.id,
                roundId: round.id,
                type: 'MISSED_SUBMISSION',
                message: `Missed submission for Round ${round.number}`,
              },
            })
            warningsCreated++
          }
        }
      }
    }

    const teamsToDisqualify = await prisma.team.findMany({
      where: {
        status: 'ACTIVE',
        warnings: { some: {} },
      },
      include: { _count: { select: { warnings: true } } },
    })

    let disqualified = 0
    for (const team of teamsToDisqualify) {
      if (team._count.warnings >= 3) {
        await prisma.team.update({
          where: { id: team.id },
          data: {
            status: 'DISQUALIFIED',
            disqualifiedAt: new Date(),
            disqualifiedReason: 'Three missed submissions',
          },
        })
        disqualified++
      }
    }

    return NextResponse.json({
      message: 'Warnings check complete',
      warningsCreated,
      teamsDisqualified: disqualified,
    })
  } catch (error) {
    logger.error('Warnings error:', error)
    return jsonError(error, 'Warnings check failed')
  }
}