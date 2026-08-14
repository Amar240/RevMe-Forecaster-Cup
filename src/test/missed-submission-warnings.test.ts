import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db'
import { createSeasonWithRounds, createTeam, createUniversity, createUser } from './fixtures'

import { processRoundTransitions } from '@/lib/round-scheduler'
import { assignMissedSubmissionWarnings } from '@/server/missed-submission-warnings'

describe('Automatic missed-submission warnings on round close', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let rounds: Awaited<ReturnType<typeof createSeasonWithRounds>>['rounds']
  let submitterTeam: Awaited<ReturnType<typeof createTeam>>
  let missingTeam: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await createUniversity('Warning Trigger University')
    const supervisor = await createUser({ email: 'sup@warn-trigger.test', role: 'SUPERVISOR', universityId: university.id })
    const bundle = await createSeasonWithRounds({ status: 'ACTIVE', name: 'Warning Trigger Season' })
    season = bundle.season
    rounds = bundle.rounds

    submitterTeam = await createTeam({ name: 'Submitter Team', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id, status: 'ACTIVE' })
    missingTeam = await createTeam({ name: 'Missing Team', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id, status: 'ACTIVE' })

    // Round 1 is OPEN by default; push its deadline into the past so a reconcile closes it.
    await prisma.round.update({ where: { id: rounds[0].id }, data: { closesAt: new Date(Date.now() - 60_000) } })

    // Only the submitter team has a submission for round 1.
    await prisma.submission.create({ data: { teamId: submitterTeam.id, roundId: rounds[0].id, submittedById: supervisor.id, locked: true } })
  })

  it('creates a missed-submission warning for the non-submitting team when the round closes via the reconcile path', async () => {
    const result = await processRoundTransitions({ trigger: 'RECOVERY', force: true })

    expect(result.closedRoundIds).toContain(rounds[0].id)

    const closedRound = await prisma.round.findUnique({ where: { id: rounds[0].id }, select: { status: true } })
    expect(closedRound?.status).toBe('CLOSED')

    const missingWarnings = await prisma.warning.findMany({
      where: { teamId: missingTeam.id, roundId: rounds[0].id, type: 'MISSED_SUBMISSION' },
    })
    expect(missingWarnings).toHaveLength(1)

    // The team that submitted must NOT be warned.
    const submitterWarnings = await prisma.warning.findMany({ where: { teamId: submitterTeam.id, roundId: rounds[0].id } })
    expect(submitterWarnings).toHaveLength(0)
  })

  it('is idempotent — re-running does not create duplicate warnings', async () => {
    await assignMissedSubmissionWarnings({ roundIds: [rounds[0].id], sendEmail: false })
    await assignMissedSubmissionWarnings({ roundIds: [rounds[0].id], sendEmail: false })

    const warnings = await prisma.warning.findMany({ where: { teamId: missingTeam.id, roundId: rounds[0].id } })
    expect(warnings).toHaveLength(1)
  })

  it('disqualifies a team once it accumulates three missed-round warnings', async () => {
    // Pre-seed two prior warnings, then close a third round with no submission.
    await prisma.warning.createMany({
      data: [
        { teamId: missingTeam.id, roundId: rounds[1].id, type: 'MISSED_SUBMISSION', message: 'Missed submission for Round 2' },
        { teamId: missingTeam.id, roundId: rounds[2].id, type: 'MISSED_SUBMISSION', message: 'Missed submission for Round 3' },
      ],
    })

    await assignMissedSubmissionWarnings({ roundIds: [rounds[0].id], sendEmail: false })

    const team = await prisma.team.findUnique({ where: { id: missingTeam.id }, select: { status: true } })
    expect(team?.status).toBe('DISQUALIFIED')
  })
})
