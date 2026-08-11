import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from './db'
import { loginAs, logout } from './auth'
import { makeRequest } from './http'
import {
  addTeamMember,
  createActual,
  createMarkets,
  createSeasonWithRounds,
  createSubmission,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'

const sendSubmissionReceiptEmail = vi.fn().mockResolvedValue(true)

vi.mock('@/server/email', () => ({
  sendSubmissionReceiptEmail,
}))

import { POST as createSeasonHandler } from '@/app/api/admin/season/route'
import { PATCH as patchRoundStatusHandler } from '@/app/api/admin/rounds/[id]/status/route'
import { PATCH as patchLeaderboardVisibilityHandler } from '@/app/api/admin/rounds/[id]/leaderboard-visibility/route'
import { POST as actualsHandler } from '@/app/api/admin/actuals/route'
import { POST as scoringHandler } from '@/app/api/admin/scoring/run/route'
import { POST as warningsHandler } from '@/app/api/admin/warnings/run/route'
import { POST as submissionHandler } from '@/app/api/submissions/route'
import { GET as currentSubmissionHandler } from '@/app/api/submissions/current/route'
import { GET as leaderboardHandler } from '@/app/api/leaderboards/route'

const BASE = 'http://localhost:5000'

function buildSubmissionEntries(markets: Array<{ id: string }>, weekOffsets: number[] = [1, 2]) {
  return markets.flatMap((market, marketIndex) =>
    weekOffsets.map((weekOffset) => ({
      marketId: market.id,
      weekOffset,
      occupancy: 70 + marketIndex + weekOffset,
      adr: 150 + marketIndex * 5 + weekOffset,
    }))
  )
}

describe('Season and round flow', () => {
  let admin: Awaited<ReturnType<typeof createUser>>
  let university: Awaited<ReturnType<typeof createUniversity>>
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let student: Awaited<ReturnType<typeof createUser>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let rounds: Awaited<ReturnType<typeof createSeasonWithRounds>>['rounds']
  let markets: Awaited<ReturnType<typeof createMarkets>>
  let team: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await createUniversity('Season Flow University')
    admin = await createUser({ email: 'admin@season-flow.test', role: 'ADMIN', universityId: university.id })
    supervisor = await createUser({
      email: 'supervisor@season-flow.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    student = await createUser({
      email: 'student@season-flow.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const bundle = await createSeasonWithRounds({ status: 'ACTIVE', name: 'Season Flow Season' })
    season = bundle.season
    rounds = bundle.rounds
    markets = await createMarkets(season.id)
    team = await createTeam({
      name: 'Season Flow Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(team.id, student.id, true)
  })

  it('cannot create a season without markets', async () => {
    await loginAs(admin.id)

    const res = await createSeasonHandler(
      makeRequest(`${BASE}/api/admin/season`, {
        method: 'POST',
        body: {
          name: 'No Markets Season',
          startDate: '2026-09-01',
          endDate: '2026-10-20',
          totalRounds: 7,
          daysPerRound: 7,
          marketIds: [],
        },
      })
    )

    expect(res.status).toBe(422)
  })

  it('cannot open a round when another round is already open', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'OPEN' },
    })
    await prisma.round.update({
      where: { id: rounds[1].id },
      data: { status: 'UPCOMING' },
    })

    await loginAs(admin.id)
    const res = await patchRoundStatusHandler(
      makeRequest(`${BASE}/api/admin/rounds/${rounds[1].id}/status`, {
        method: 'PATCH',
        body: { status: 'OPEN' },
      }),
      { params: Promise.resolve({ id: rounds[1].id }) }
    )

    expect(res.status).toBe(422)
  })

  it('enforces the closesAt deadline even if the round stays OPEN in the database', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: {
        status: 'OPEN',
        closesAt: new Date(Date.now() - 60 * 1000),
      },
    })

    await loginAs(student.id)
    const res = await currentSubmissionHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.currentRound.id).toBe(rounds[1].id)
    expect(data.canSubmit).toBe(false)
    expect(data.lockReason).toBe('ROUND_NOT_OPEN')
  })

  it('returns an empty leaderboard when no submissions have been scored', async () => {
    logout()

    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard).toEqual([])
  })

  it('hides unpublished rounds from public leaderboard metadata', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { leaderboardVisible: false },
    })

    logout()
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.rounds.some((round: { id: string }) => round.id === rounds[0].id)).toBe(false)
  })

  it('shows published rounds in public leaderboard metadata', async () => {
    await loginAs(admin.id)
    const patchRes = await patchLeaderboardVisibilityHandler(
      makeRequest(`${BASE}/api/admin/rounds/${rounds[0].id}/leaderboard-visibility`, {
        method: 'PATCH',
        body: { visible: true },
      }),
      { params: Promise.resolve({ id: rounds[0].id }) }
    )
    expect(patchRes.status).toBe(200)

    logout()
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.rounds.some((round: { id: string }) => round.id === rounds[0].id)).toBe(true)
  })

  it('does not allow opening rounds for a completed season', async () => {
    await prisma.season.update({
      where: { id: season.id },
      data: { status: 'COMPLETED' },
    })
    await prisma.round.update({
      where: { id: rounds[1].id },
      data: { status: 'UPCOMING' },
    })

    await loginAs(admin.id)
    const res = await patchRoundStatusHandler(
      makeRequest(`${BASE}/api/admin/rounds/${rounds[1].id}/status`, {
        method: 'PATCH',
        body: { status: 'OPEN' },
      }),
      { params: Promise.resolve({ id: rounds[1].id }) }
    )

    expect(res.status).toBe(422)
  })

  it('returns 404 when uploading actuals for a round that does not exist', async () => {
    await loginAs(admin.id)

    const res = await actualsHandler(
      makeRequest(`${BASE}/api/admin/actuals`, {
        method: 'POST',
        body: {
          roundId: 'missing-round',
          marketId: markets[0].id,
          weekOffset: 1,
          metric: 'OCCUPANCY',
          value: 77,
        },
      })
    )

    expect(res.status).toBe(404)
  })

  it('blocks scoring when a score-ready round is missing actuals', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: {
        closesAt: new Date(Date.now() - 60 * 1000),
      },
    })

    await createSubmission({
      teamId: team.id,
      roundId: rounds[0].id,
      submittedById: student.id,
      values: markets.flatMap((market) => [
        { marketId: market.id, metric: 'OCCUPANCY' as const, weekOffset: 1, value: 80 },
        { marketId: market.id, metric: 'ADR' as const, weekOffset: 1, value: 160 },
        { marketId: market.id, metric: 'OCCUPANCY' as const, weekOffset: 2, value: 81 },
        { marketId: market.id, metric: 'ADR' as const, weekOffset: 2, value: 161 },
      ]),
    })

    await loginAs(admin.id)
    const res = await scoringHandler(
      makeRequest(`${BASE}/api/admin/scoring/run`, {
        method: 'POST',
        body: { seasonId: season.id, scope: 'SEASON' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toContain('Scoring cannot run until actuals are complete')
    expect(data.message).toContain('Round 1')

    const scoringRuns = await prisma.scoringRun.count({
      where: { seasonId: season.id },
    })
    const scoreAggregates = await prisma.scoreAggregate.count({
      where: { seasonId: season.id },
    })

    expect(scoringRuns).toBe(0)
    expect(scoreAggregates).toBe(0)
  })

  it('creates a warning when a team misses a closed round', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: {
        closesAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    })

    await loginAs(admin.id)
    const res = await warningsHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.warningsCreated).toBeGreaterThanOrEqual(1)

    const warnings = await prisma.warning.findMany({
      where: { teamId: team.id },
    })
    expect(warnings).toHaveLength(1)
  })

  it('disqualifies a team after three warnings', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    for (const round of rounds.slice(0, 3)) {
      await prisma.round.update({
        where: { id: round.id },
        data: { closesAt: past },
      })
    }

    await loginAs(admin.id)
    const res = await warningsHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.teamsDisqualified).toBe(1)

    const updatedTeam = await prisma.team.findUniqueOrThrow({
      where: { id: team.id },
    })
    expect(updatedTeam.status).toBe('DISQUALIFIED')
  })

  it('does not include disqualified teams on the leaderboard', async () => {
    const activeTeam = await createTeam({
      name: 'Ranked Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await prisma.scoreAggregate.create({
      data: {
        seasonId: season.id,
        teamId: team.id,
        metric: 'OCCUPANCY',
        scopeType: 'SEASON',
        roundId: null,
        marketId: null,
        mape: 0.1,
        nErrors: 39,
        scoringRunId: 'warning-run',
      },
    })
    await prisma.scoreAggregate.create({
      data: {
        seasonId: season.id,
        teamId: activeTeam.id,
        metric: 'OCCUPANCY',
        scopeType: 'SEASON',
        roundId: null,
        marketId: null,
        mape: 0.05,
        nErrors: 39,
        scoringRunId: 'warning-run',
      },
    })
    await prisma.team.update({
      where: { id: team.id },
      data: { status: 'DISQUALIFIED' },
    })

    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard.some((entry: { teamId: string }) => entry.teamId === team.id)).toBe(false)
    expect(data.leaderboard.some((entry: { teamId: string }) => entry.teamId === activeTeam.id)).toBe(true)
  })
})
