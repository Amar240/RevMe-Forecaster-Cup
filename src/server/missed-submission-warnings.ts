import { prisma } from '@/lib/db'
import { sendMissedSubmissionWarning } from '@/lib/email'
import { closeOpenSupervisorAssignment } from '@/server/team-supervisor-assignment'
import { logger } from '@/server/logger'

const DISQUALIFY_THRESHOLD = 3

export interface AssignMissedSubmissionWarningsOptions {
  /** Restrict to specific closed rounds (e.g. the rounds a close just produced). */
  roundIds?: string[]
  /** Restrict to a season; without roundIds, sweeps every closed round in the season. */
  seasonId?: string
  /** Send the N/3 warning email to team members for each new warning. */
  sendEmail?: boolean
  /** Actor recorded when a team is disqualified; null for automatic/system triggers. */
  actorId?: string | null
}

export interface AssignMissedSubmissionWarningsResult {
  warningsCreated: number
  teamsDisqualified: number
  emailsSent: number
}

/**
 * Single source of truth for missed-submission warnings. Idempotent: a team that already holds a
 * MISSED_SUBMISSION warning for a round is never warned again, so this is safe to call repeatedly and
 * from multiple close paths. Creates warnings, optionally emails members, and disqualifies teams that
 * reach the warning threshold.
 */
export async function assignMissedSubmissionWarnings(
  options: AssignMissedSubmissionWarningsOptions = {}
): Promise<AssignMissedSubmissionWarningsResult> {
  const now = new Date()
  const empty: AssignMissedSubmissionWarningsResult = { warningsCreated: 0, teamsDisqualified: 0, emailsSent: 0 }

  // Resolve the closed rounds to check.
  const closedRounds = await prisma.round.findMany({
    where: options.roundIds && options.roundIds.length > 0
      ? { id: { in: options.roundIds }, closesAt: { lt: now } }
      : { closesAt: { lt: now }, ...(options.seasonId ? { seasonId: options.seasonId } : {}) },
    select: { id: true, number: true, seasonId: true },
  })
  if (closedRounds.length === 0) return empty

  const roundIds = closedRounds.map((r) => r.id)
  const roundNumberMap = new Map(closedRounds.map((r) => [r.id, r.number]))
  const seasonIds = Array.from(new Set(closedRounds.map((r) => r.seasonId)))

  // Active teams in scope, with members (for email) and current warning totals.
  const activeTeams = await prisma.team.findMany({
    where: { status: 'ACTIVE', ...(options.seasonId ? { seasonId: options.seasonId } : { seasonId: { in: seasonIds } }) },
    select: {
      id: true,
      name: true,
      members: { select: { user: { select: { email: true } } } },
      _count: { select: { warnings: true } },
    },
  })
  if (activeTeams.length === 0) return empty

  const teamIds = activeTeams.map((t) => t.id)

  const [existingSubmissions, existingWarnings] = await Promise.all([
    prisma.submission.findMany({
      where: { roundId: { in: roundIds }, teamId: { in: teamIds } },
      select: { teamId: true, roundId: true },
    }),
    prisma.warning.findMany({
      where: { roundId: { in: roundIds }, teamId: { in: teamIds }, type: 'MISSED_SUBMISSION' },
      select: { teamId: true, roundId: true },
    }),
  ])

  const submissionSet = new Set(existingSubmissions.map((s) => `${s.teamId}:${s.roundId}`))
  const warningSet = new Set(existingWarnings.map((w) => `${w.teamId}:${w.roundId}`))

  // Build the set of new warnings, ordered so we can compute a running N/3 per team for emails.
  const warningsToCreate: { teamId: string; roundId: string; roundNumber: number }[] = []
  for (const team of activeTeams) {
    for (const round of closedRounds) {
      const key = `${team.id}:${round.id}`
      if (!submissionSet.has(key) && !warningSet.has(key)) {
        warningsToCreate.push({ teamId: team.id, roundId: round.id, roundNumber: round.number })
      }
    }
  }

  if (warningsToCreate.length === 0) return empty

  await prisma.warning.createMany({
    data: warningsToCreate.map((w) => ({
      teamId: w.teamId,
      roundId: w.roundId,
      type: 'MISSED_SUBMISSION' as const,
      message: `Missed submission for Round ${w.roundNumber}`,
    })),
  })

  const teamById = new Map(activeTeams.map((t) => [t.id, t]))

  // Emails (outside any transaction). Running count starts from the team's existing warning total.
  let emailsSent = 0
  if (options.sendEmail) {
    const runningCount = new Map<string, number>()
    for (const warning of warningsToCreate) {
      const team = teamById.get(warning.teamId)
      if (!team) continue
      const nextCount = (runningCount.get(team.id) ?? team._count.warnings) + 1
      runningCount.set(team.id, nextCount)
      for (const member of team.members) {
        const sent = await sendMissedSubmissionWarning(member.user.email, team.name, warning.roundNumber, nextCount)
        if (sent) emailsSent++
      }
    }
  }

  // Disqualify teams that reached the threshold.
  let teamsDisqualified = 0
  const newWarningsByTeam = new Map<string, number>()
  for (const warning of warningsToCreate) {
    newWarningsByTeam.set(warning.teamId, (newWarningsByTeam.get(warning.teamId) ?? 0) + 1)
  }
  const teamsToDisqualify = activeTeams.filter(
    (t) => t._count.warnings + (newWarningsByTeam.get(t.id) ?? 0) >= DISQUALIFY_THRESHOLD
  )
  for (const team of teamsToDisqualify) {
    await prisma.$transaction(async (tx) => {
      const current = await tx.team.findUnique({ where: { id: team.id }, select: { status: true } })
      if (current?.status !== 'ACTIVE') return
      await tx.team.update({
        where: { id: team.id },
        data: { status: 'DISQUALIFIED', disqualifiedAt: new Date(), disqualifiedReason: 'Three missed submissions' },
      })
      await closeOpenSupervisorAssignment({
        teamId: team.id,
        endedById: options.actorId ?? null,
        reason: 'Team disqualified after three missed submissions',
        db: tx,
      })
      teamsDisqualified++
    })
  }

  logger.info('Assigned missed-submission warnings', {
    warningsCreated: warningsToCreate.length,
    teamsDisqualified,
    emailsSent,
    roundIds,
  })

  return { warningsCreated: warningsToCreate.length, teamsDisqualified, emailsSent }
}
