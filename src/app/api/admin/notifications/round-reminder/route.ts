import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { sendRoundOpenEmail } from '@/lib/email'

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

    const currentRound = await prisma.round.findFirst({
      where: {
        seasonId: activeSeason.id,
        opensAt: { lte: new Date() },
        closesAt: { gt: new Date() },
      },
    })

    if (!currentRound) {
      return NextResponse.json({ message: 'No active round' }, { status: 400 })
    }

    const teams = await prisma.team.findMany({
      where: { status: 'ACTIVE' },
      include: {
        members: {
          where: { isSubmitter: true },
          include: { user: true },
        },
      },
    })

    const existingSubmissions = await prisma.submission.findMany({
      where: { roundId: currentRound.id },
      select: { teamId: true },
    })
    const submittedTeamIds = new Set(existingSubmissions.map((s) => s.teamId))

    let emailsSent = 0
    for (const team of teams) {
      if (submittedTeamIds.has(team.id)) continue

      const submitter = team.members[0]
      if (submitter?.user.email) {
        const sent = await sendRoundOpenEmail(
          submitter.user.email,
          currentRound.number,
          currentRound.closesAt,
          team.name
        )
        if (sent) emailsSent++
      }
    }

    return NextResponse.json({
      message: `Sent ${emailsSent} round reminder emails`,
      emailsSent,
    })
  } catch (error) {
    console.error('Round reminder error:', error)
    return NextResponse.json({ message: 'Failed to send reminders' }, { status: 500 })
  }
}
