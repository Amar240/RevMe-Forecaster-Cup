import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function processRoundTransitions(): Promise<{ opened: number; closed: number }> {
  const now = new Date()

  const openedResult = await prisma.round.updateMany({
    where: {
      status: 'UPCOMING',
      opensAt: { lte: now },
    },
    data: {
      status: 'OPEN',
    },
  })

  const closedResult = await prisma.round.updateMany({
    where: {
      status: 'OPEN',
      closesAt: { lte: now },
    },
    data: {
      status: 'CLOSED',
    },
  })

  const opened = openedResult.count
  const closed = closedResult.count

  logger.info('Round scheduler opened rounds', { opened, now: now.toISOString() })
  logger.info('Round scheduler closed rounds', { closed, now: now.toISOString() })

  return { opened, closed }
}
