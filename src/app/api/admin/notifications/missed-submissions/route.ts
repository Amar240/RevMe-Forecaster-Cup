import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sendMissedSubmissionWarning } from '@/lib/email'

export async function POST() {
  try {
    const user = await getSession()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const activeSeason = await prisma.season.findFirst({
      where: { status: 'ACTIVE' },
    })

    if (!activeSeason) {
      return NextResponse.json({ message: 'No active season' }, { status: 400 })
    }

    const closedRounds = await prisma.round.findMany({
      where: {
        seasonId: activeSeason.id,
        closesAt: { lt: new Date() },
      },
      orderBy: { number: 'desc' },
    })

    if (closedRounds.length === 0) {
      return NextResponse.json({ message: 'No closed rounds' }, { status: 400 })
    }

    const lastClosedRound = closedRounds[0]

    const teams = await prisma.team.findMany({
      where: { status: 'ACTIVE' },
      include: {
        members: { include: { user: true } },
        warnings: true,
      },
    })

    const submissions = await prisma.submission.findMany({
      where: { roundId: lastClosedRound.id },
      select: { teamId: true },
    })
    const submittedTeamIds = new Set(submissions.map((s) => s.teamId))

    let warningsIssued = 0
    let disqualified = 0
    let emailsSent = 0

    for (const team of teams) {
      if (submittedTeamIds.has(team.id)) continue

      const existingWarning = await prisma.warning.findFirst({
        where: { teamId: team.id, roundId: lastClosedRound.id },
      })
      if (existingWarning) continue

      await prisma.warning.create({
        data: {
          teamId: team.id,
          roundId: lastClosedRound.id,
          type: 'MISSED_SUBMISSION',
          message: `Missed submission for Round ${lastClosedRound.number}`,
        },
      })
      warningsIssued++

      const warningCount = team.warnings.length + 1

      if (warningCount >= 3) {
        await prisma.team.update({
          where: { id: team.id },
          data: { status: 'DISQUALIFIED' },
        })
        disqualified++
      }

      for (const member of team.members) {
        const sent = await sendMissedSubmissionWarning(
          member.user.email,
          team.name,
          lastClosedRound.number,
          warningCount
        )
        if (sent) emailsSent++
      }
    }

    return NextResponse.json({
      message: `Processed missed submissions: ${warningsIssued} warnings, ${disqualified} disqualified, ${emailsSent} emails sent`,
      warningsIssued,
      disqualified,
      emailsSent,
    })
  } catch (error) {
    console.error('Missed submissions error:', error)
    return NextResponse.json({ message: 'Failed to process missed submissions' }, { status: 500 })
  }
}
