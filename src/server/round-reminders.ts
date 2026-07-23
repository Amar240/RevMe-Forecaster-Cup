import { prisma } from '@/server/db'
import { sendRoundOpenEmail } from '@/lib/email'
import { logger } from '@/server/logger'

export async function processDeadlineReminders(now = new Date()) {
  const seasons = await prisma.season.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })
  let notificationsCreated = 0
  let emailsSent = 0
  for (const season of seasons) {
    const rounds = await prisma.round.findMany({ where: { seasonId: season.id, status: 'OPEN', closesAt: { gt: now, lte: new Date(now.getTime() + 48 * 60 * 60 * 1000) } }, select: { id: true, number: true, closesAt: true } })
    for (const round of rounds) {
      const hoursRemaining = (round.closesAt.getTime() - now.getTime()) / 3_600_000
      const bucket = hoursRemaining <= 24 ? 24 : 48
      const type = `ROUND_REMINDER_${bucket}H`
      const link = `/submit?roundId=${round.id}`
      const teams = await prisma.team.findMany({ where: { seasonId: season.id, status: 'ACTIVE', submissions: { none: { roundId: round.id } } }, select: { name: true, members: { where: { isSubmitter: true }, select: { user: { select: { id: true, email: true } } }, take: 1 } } })
      for (const team of teams) {
        const submitter = team.members[0]?.user
        if (!submitter) continue
        try {
          await prisma.emailDispatch.create({ data: { type, recipientId: submitter.id, roundId: round.id, success: false } })
        } catch (error) {
          if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') continue
          throw error
        }
        await prisma.notification.create({ data: { userId: submitter.id, type, title: `Round ${round.number} deadline reminder`, message: `${bucket} hours or less remain to submit your team forecast.`, link } })
        notificationsCreated += 1
        try {
          const sent = await sendRoundOpenEmail(submitter.email, round.number, round.closesAt, team.name)
          await prisma.emailDispatch.update({ where: { type_recipientId_roundId: { type, recipientId: submitter.id, roundId: round.id } }, data: { success: sent } })
          if (sent) emailsSent += 1
        } catch (error) {
          logger.error('Deadline reminder email failed after notification creation', { error, userId: submitter.id, roundId: round.id })
        }
      }
    }
  }
  return { notificationsCreated, emailsSent }
}
