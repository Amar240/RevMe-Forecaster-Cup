import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/server/db'
import { z } from 'zod'
import { logger } from '@/server/logger'
import { requireUserOrResponse, jsonError } from '@/server/http'
import { sendSubmissionReceiptEmail } from '@/server/email'

const submissionSchema = z.object({
  roundId: z.string().min(1),
  submissions: z.array(
    z.object({
      marketId: z.string().min(1),
      weekOffset: z.number().int().min(1).max(2),
      occupancy: z.number().min(0).max(100),
      adr: z.number().min(0),
    })
  ),
})

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    const authUser = user!

    const body = await request.json()
    const data = submissionSchema.parse(body)

    const round = await prisma.round.findUnique({
      where: { id: data.roundId },
      include: { season: true },
    })

    if (!round) {
      return NextResponse.json({ message: 'Round not found' }, { status: 404 })
    }

    if (!round.season || round.season.status !== 'ACTIVE') {
      return NextResponse.json({ message: 'Season is not active' }, { status: 400 })
    }

    if (round.status !== 'OPEN') {
      return NextResponse.json({ message: 'Round is not open' }, { status: 400 })
    }

    if (new Date(round.closesAt) < new Date()) {
      return NextResponse.json({ message: 'Round is closed' }, { status: 400 })
    }

    const teamMember = await prisma.teamMember.findFirst({
      where: { userId: authUser.id, isSubmitter: true },
      include: { team: { include: { supervisor: true } } },
    })

    if (!teamMember || !teamMember.team) {
      return NextResponse.json({ message: 'You are not a team submitter' }, { status: 403 })
    }

    if (teamMember.team.status !== 'ACTIVE') {
      return NextResponse.json({ message: 'Team is not active' }, { status: 403 })
    }

    const existing = await prisma.submission.findUnique({
      where: {
        teamId_roundId: {
          teamId: teamMember.teamId,
          roundId: round.id,
        },
      },
    })

    if (existing) {
      return NextResponse.json({ message: 'Submission already exists' }, { status: 409 })
    }

    const activeMarkets = await prisma.seasonMarket.findMany({
      where: { seasonId: round.seasonId, isActive: true },
      include: { market: true },
    })

    if (activeMarkets.length !== 3) {
      return NextResponse.json({ message: 'Season must have exactly 3 active markets' }, { status: 400 })
    }

    const marketIds = new Set(activeMarkets.map((sm) => sm.marketId))
    const allowedWeeks = round.isFinal ? [1] : [1, 2]

    const expectedKeys = new Set<string>()
    for (const sm of activeMarkets) {
      for (const week of allowedWeeks) {
        expectedKeys.add(`${sm.marketId}-${week}`)
      }
    }

    const receivedKeys = new Set<string>()
    for (const submission of data.submissions) {
      if (!marketIds.has(submission.marketId)) {
        return NextResponse.json({ message: 'Invalid market in submission' }, { status: 400 })
      }
      if (!allowedWeeks.includes(submission.weekOffset)) {
        return NextResponse.json({ message: 'Invalid week offset' }, { status: 400 })
      }
      const key = `${submission.marketId}-${submission.weekOffset}`
      if (receivedKeys.has(key)) {
        return NextResponse.json({ message: 'Duplicate market/week submission' }, { status: 400 })
      }
      receivedKeys.add(key)
    }

    if (receivedKeys.size !== expectedKeys.size) {
      return NextResponse.json({ message: 'Missing submissions for one or more markets/weeks' }, { status: 400 })
    }

    const submission = await prisma.submission.create({
      data: {
        teamId: teamMember.teamId,
        roundId: round.id,
        submittedById: authUser.id,
        locked: true,
      },
    })

    const values = data.submissions.flatMap((entry) => [
      {
        submissionId: submission.id,
        marketId: entry.marketId,
        metric: 'OCCUPANCY' as const,
        weekOffset: entry.weekOffset,
        value: entry.occupancy,
      },
      {
        submissionId: submission.id,
        marketId: entry.marketId,
        metric: 'ADR' as const,
        weekOffset: entry.weekOffset,
        value: entry.adr,
      },
    ])

    await prisma.submissionValue.createMany({ data: values })

    const submittedByName = `${authUser.firstName} ${authUser.lastName}`.trim()
    const supervisorEmail = teamMember.team.supervisor?.email

    const [studentSent, supervisorSent] = await Promise.all([
      sendSubmissionReceiptEmail({
        email: authUser.email,
        teamName: teamMember.team.name,
        roundNumber: round.number,
        submittedAt: submission.submittedAt,
        submittedByName,
        recipientRole: 'STUDENT',
      }),
      supervisorEmail
        ? sendSubmissionReceiptEmail({
            email: supervisorEmail,
            teamName: teamMember.team.name,
            roundNumber: round.number,
            submittedAt: submission.submittedAt,
            submittedByName,
            recipientRole: 'SUPERVISOR',
          })
        : Promise.resolve(false),
    ])

    if (studentSent || supervisorSent) {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { emailSentAt: new Date() },
      })
    }

    return NextResponse.json({ message: 'Submission saved' }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid input', errors: error.errors }, { status: 400 })
    }
    logger.error('Create submission error:', error)
    return jsonError(error, 'Failed to submit')
  }
}


