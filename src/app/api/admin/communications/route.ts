import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const sendEmailSchema = z.object({
  type: z.enum(['round_reminder', 'results_published', 'custom_announcement', 'missed_submission']),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  recipientFilter: z.enum(['all', 'students', 'supervisors', 'missing_submissions', 'specific_team']).default('all'),
  teamId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse('notifications:send')
    if (response) return response

    const data = await parseJson(request, sendEmailSchema)

    let recipients: { email: string; firstName: string; lastName: string }[] = []

    if (data.recipientFilter === 'all') {
      const users = await prisma.user.findMany({
        where: { role: { in: ['STUDENT', 'SUPERVISOR'] } },
        select: { email: true, firstName: true, lastName: true },
      })
      recipients = users
    } else if (data.recipientFilter === 'students') {
      const users = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { email: true, firstName: true, lastName: true },
      })
      recipients = users
    } else if (data.recipientFilter === 'supervisors') {
      const users = await prisma.user.findMany({
        where: { role: 'SUPERVISOR' },
        select: { email: true, firstName: true, lastName: true },
      })
      recipients = users
    } else if (data.recipientFilter === 'missing_submissions') {
      const activeSeason = await prisma.season.findFirst({
        where: { status: 'ACTIVE' },
        include: { rounds: { orderBy: { number: 'desc' }, take: 1 } },
      })
      if (activeSeason?.rounds[0]) {
        const currentRound = activeSeason.rounds[0]
        const submittedTeamIds = (await prisma.submission.findMany({
          where: { roundId: currentRound.id },
          select: { teamId: true },
          distinct: ['teamId'],
        })).map(s => s.teamId)

        const missingTeams = await prisma.team.findMany({
          where: {
            status: 'ACTIVE',
            seasonId: activeSeason.id,
            id: { notIn: submittedTeamIds },
          },
          include: {
            members: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
            supervisor: { select: { email: true, firstName: true, lastName: true } },
          },
        })
        for (const team of missingTeams) {
          for (const member of team.members) {
            recipients.push(member.user)
          }
          if (team.supervisor) {
            recipients.push(team.supervisor)
          }
        }
      }
    }

    const uniqueRecipients = Array.from(
      new Map(recipients.map(r => [r.email, r])).values()
    )

    if (uniqueRecipients.length === 0) {
      return jsonOk({ sent: 0, message: 'No recipients matched the filter' })
    }

    let subject = data.subject || ''
    let body = data.body || ''

    const templates: Record<string, { subject: string; body: string }> = {
      round_reminder: {
        subject: 'Reminder: Submission Deadline Approaching',
        body: 'This is a reminder that the submission deadline for the current round is approaching. Please submit your forecasts before the deadline.',
      },
      results_published: {
        subject: 'Competition Results Published',
        body: 'The scoring results for the latest round have been published. Log in to view your scores and the updated leaderboard.',
      },
      missed_submission: {
        subject: 'Missed Submission Warning',
        body: 'You have not submitted your forecasts for the current round. Please note that missed submissions may result in warnings and potential disqualification.',
      },
      custom_announcement: {
        subject: subject || 'Competition Announcement',
        body: body || '',
      },
    }

    const template = templates[data.type]
    if (!subject) subject = template.subject
    if (!body) body = template.body

    let sentCount = 0
    const batchSize = 10
    for (let i = 0; i < uniqueRecipients.length; i += batchSize) {
      const batch = uniqueRecipients.slice(i, i + batchSize)
      await Promise.allSettled(
        batch.map(recipient =>
          sendEmail({
            to: recipient.email,
            subject,
            html: `<p>Dear ${recipient.firstName},</p><p>${body.replace(/\n/g, '<br/>')}</p><p>— RevME Competition Team</p>`,
          })
        )
      )
      sentCount += batch.length
    }

    const activeSeason = await prisma.season.findFirst({ where: { status: 'ACTIVE' } })
    if (activeSeason) {
      const userIds = await prisma.user.findMany({
        where: { email: { in: uniqueRecipients.map(r => r.email) } },
        select: { id: true },
      })
      await prisma.notification.createMany({
        data: userIds.map(u => ({
          userId: u.id,
          type: data.type === 'round_reminder' ? 'ROUND_REMINDER' : data.type === 'results_published' ? 'RESULTS_PUBLISHED' : 'GENERAL',
          title: subject,
          message: body.slice(0, 500),
        })),
      })
    }

    await logAuditAction(
      user!.id,
      'SEND_NOTIFICATION',
      'Communication',
      null,
      { type: data.type, recipientFilter: data.recipientFilter, sentCount }
    )

    return jsonOk({ sent: sentCount, message: `Email sent to ${sentCount} recipients` })
  } catch (error) {
    return jsonError(error, 'Failed to send communications')
  }
}

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response

    const recentNotifications = await prisma.notification.findMany({
      where: { type: { in: ['ROUND_REMINDER', 'RESULTS_PUBLISHED', 'GENERAL'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      distinct: ['title', 'createdAt'],
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        createdAt: true,
      },
    })

    return jsonOk({ notifications: recentNotifications })
  } catch (error) {
    return jsonError(error, 'Failed to load communications history')
  }
}
