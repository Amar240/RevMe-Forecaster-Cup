import { prisma } from '@/lib/db'

export type RunbookStatus = 'done' | 'pending' | 'blocked'

export interface RoundRunbookItem {
  key: 'opens' | 'reminders' | 'closes' | 'actuals' | 'scoring' | 'review' | 'publish' | 'notify'
  label: string
  detail: string
  status: RunbookStatus
  href: string
}

export interface RoundRunbookRound {
  id: string
  number: number
  timing: 'current' | 'next'
  items: RoundRunbookItem[]
}

export interface RoundRunbookInput {
  id: string
  number: number
  opensAt: Date
  closesAt: Date
  isFinal: boolean
  leaderboardReviewed: boolean
  leaderboardVisible: boolean
  participantsNotified: boolean
  actualCount: number
  activeMarketCount: number
  scored: boolean
  reminderDispatches: number
  submittedTeams: number
  activeTeams: number
}

export function deriveRoundRunbook(
  round: RoundRunbookInput,
  now: Date,
  timing: RoundRunbookRound['timing']
): RoundRunbookRound {
  const opened = now >= round.opensAt
  const closed = now > round.closesAt
  const expectedActuals = round.activeMarketCount * 2 * (round.isFinal ? 1 : 2)
  const actualsComplete = expectedActuals > 0 && round.actualCount >= expectedActuals
  const remindersComplete = round.activeTeams === 0 || round.submittedTeams >= round.activeTeams || round.reminderDispatches > 0
  const hoursRemaining = Math.max(0, (round.closesAt.getTime() - now.getTime()) / 3_600_000)

  const downstream = (done: boolean, unblocked: boolean): RunbookStatus =>
    done ? 'done' : unblocked ? 'pending' : 'blocked'

  return {
    id: round.id,
    number: round.number,
    timing,
    items: [
      { key: 'opens', label: 'Round opens', detail: opened ? 'Opened automatically' : `Opens ${round.opensAt.toLocaleString()}`, status: opened ? 'done' : 'pending', href: '/admin/season' },
      { key: 'reminders', label: 'Submission reminders', detail: remindersComplete ? (round.submittedTeams >= round.activeTeams ? 'All active teams submitted' : 'Reminder dispatch recorded') : hoursRemaining > 48 ? 'Scheduled at 48 and 24 hours' : `${round.activeTeams - round.submittedTeams} teams still pending`, status: downstream(remindersComplete, opened && !closed), href: '/admin/communications' },
      { key: 'closes', label: 'Round closes', detail: closed ? 'Closed automatically' : `${hoursRemaining.toFixed(1)} hours remaining`, status: closed ? 'done' : 'pending', href: '/admin/season' },
      { key: 'actuals', label: 'Upload actuals', detail: `${round.actualCount}/${expectedActuals} values uploaded`, status: downstream(actualsComplete, closed), href: '/admin/actuals' },
      { key: 'scoring', label: 'Run scoring', detail: round.scored ? 'Scoring complete' : 'Waiting for complete actuals', status: downstream(round.scored, actualsComplete), href: '/admin/scoring' },
      { key: 'review', label: 'Review leaderboard', detail: round.leaderboardReviewed ? 'Reviewed' : 'Review before publishing', status: downstream(round.leaderboardReviewed, round.scored), href: '/admin/scoring' },
      { key: 'publish', label: 'Publish leaderboard', detail: round.leaderboardVisible ? 'Visible to participants' : 'Not yet visible', status: downstream(round.leaderboardVisible, round.leaderboardReviewed), href: '/admin/season' },
      { key: 'notify', label: 'Notify participants', detail: round.participantsNotified ? 'Participants notified' : 'Notification pending', status: downstream(round.participantsNotified, round.leaderboardVisible), href: '/admin/communications' },
    ],
  }
}

export async function getRoundRunbook(seasonId: string, now = new Date()): Promise<RoundRunbookRound[]> {
  const [rounds, activeMarketCount, activeTeams] = await Promise.all([
    prisma.round.findMany({
      where: { seasonId },
      orderBy: { number: 'asc' },
      include: { _count: { select: { actuals: { where: { isVoided: false } }, submissions: true } } },
    }),
    prisma.seasonMarket.count({ where: { seasonId, isActive: true } }),
    prisma.team.count({ where: { seasonId, status: 'ACTIVE' } }),
  ])

  const currentIndex = rounds.findIndex((round) => round.opensAt <= now && round.closesAt >= now)
  const firstFutureIndex = rounds.findIndex((round) => round.opensAt > now)
  const primaryIndex = currentIndex >= 0 ? currentIndex : firstFutureIndex >= 0 ? firstFutureIndex : rounds.length - 1
  const selected = rounds.slice(Math.max(0, primaryIndex), Math.max(0, primaryIndex) + 2)

  return Promise.all(selected.map(async (round, index) => {
    const [scored, reminderDispatches] = await Promise.all([
      prisma.scoreAggregate.count({ where: { seasonId, roundId: round.id, scopeType: 'ROUND' } }),
      prisma.emailDispatch.count({ where: { roundId: round.id, type: { startsWith: 'ROUND_REMINDER_' }, success: true } }),
    ])
    return deriveRoundRunbook({
      id: round.id,
      number: round.number,
      opensAt: round.opensAt,
      closesAt: round.closesAt,
      isFinal: round.isFinal,
      leaderboardReviewed: round.leaderboardReviewed,
      leaderboardVisible: round.leaderboardVisible,
      participantsNotified: round.participantsNotified,
      actualCount: round._count.actuals,
      activeMarketCount,
      scored: scored > 0,
      reminderDispatches,
      submittedTeams: round._count.submissions,
      activeTeams,
    }, now, index === 0 ? 'current' : 'next')
  }))
}
