import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs, logout } from './auth'
import { createSeasonWithRounds, createTeam, createUniversity, createUser } from './fixtures'
import { makeRequest } from './http'

import { GET as leaderboardHandler } from '@/app/api/leaderboards/route'

const BASE = 'http://localhost:5000'

describe('Leaderboard behavior', () => {
  let admin: Awaited<ReturnType<typeof createUser>>
  let universityA: Awaited<ReturnType<typeof createUniversity>>
  let universityB: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let rounds: Awaited<ReturnType<typeof createSeasonWithRounds>>['rounds']
  let alphaTeam: Awaited<ReturnType<typeof createTeam>>
  let bravoTeam: Awaited<ReturnType<typeof createTeam>>
  let gammaTeam: Awaited<ReturnType<typeof createTeam>>
  let disqualifiedTeam: Awaited<ReturnType<typeof createTeam>>
  let pendingTeam: Awaited<ReturnType<typeof createTeam>>
  let student: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    universityA = await createUniversity('Leaderboard University A')
    universityB = await createUniversity('Leaderboard University B')
    admin = await createUser({ email: 'admin@leaderboard.test', role: 'ADMIN', universityId: universityA.id })
    student = await createUser({ email: 'student@leaderboard.test', role: 'STUDENT', universityId: universityA.id })

    const bundle = await createSeasonWithRounds({ status: 'ACTIVE', name: 'Leaderboard Season' })
    season = bundle.season
    rounds = bundle.rounds

    const supervisorA = await createUser({
      email: 'supervisor-a@leaderboard.test',
      role: 'SUPERVISOR',
      universityId: universityA.id,
    })
    const supervisorB = await createUser({
      email: 'supervisor-b@leaderboard.test',
      role: 'SUPERVISOR',
      universityId: universityA.id,
    })
    const supervisorC = await createUser({
      email: 'supervisor-c@leaderboard.test',
      role: 'SUPERVISOR',
      universityId: universityB.id,
    })

    alphaTeam = await createTeam({
      name: 'Alpha Team',
      supervisorId: supervisorA.id,
      universityId: universityA.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    bravoTeam = await createTeam({
      name: 'Bravo Team',
      supervisorId: supervisorB.id,
      universityId: universityA.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    gammaTeam = await createTeam({
      name: 'Gamma Team',
      supervisorId: supervisorC.id,
      universityId: universityB.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    disqualifiedTeam = await createTeam({
      name: 'Disqualified Team',
      supervisorId: supervisorA.id,
      universityId: universityA.id,
      seasonId: season.id,
      status: 'DISQUALIFIED',
    })
    pendingTeam = await createTeam({
      name: 'Pending Team',
      supervisorId: supervisorC.id,
      universityId: universityB.id,
      seasonId: season.id,
      status: 'PENDING_APPROVAL',
    })

    const aggregates = [
      { teamId: alphaTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'SEASON' as const, mape: 0.08, nErrors: 39 },
      { teamId: alphaTeam.id, metric: 'ADR' as const, scopeType: 'SEASON' as const, mape: 0.12, nErrors: 39 },
      { teamId: bravoTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'SEASON' as const, mape: 0.09, nErrors: 39 },
      { teamId: bravoTeam.id, metric: 'ADR' as const, scopeType: 'SEASON' as const, mape: 0.11, nErrors: 39 },
      { teamId: gammaTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'SEASON' as const, mape: 0.13, nErrors: 39 },
      { teamId: gammaTeam.id, metric: 'ADR' as const, scopeType: 'SEASON' as const, mape: 0.13, nErrors: 39 },
      { teamId: disqualifiedTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'SEASON' as const, mape: 0.01, nErrors: 39 },
      { teamId: disqualifiedTeam.id, metric: 'ADR' as const, scopeType: 'SEASON' as const, mape: 0.01, nErrors: 39 },
      { teamId: pendingTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'SEASON' as const, mape: 0.02, nErrors: 39 },
      { teamId: pendingTeam.id, metric: 'ADR' as const, scopeType: 'SEASON' as const, mape: 0.02, nErrors: 39 },
      { teamId: alphaTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'ROUND' as const, roundId: rounds[0].id, mape: 0.1, nErrors: 6 },
      { teamId: alphaTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'ROUND' as const, roundId: rounds[1].id, mape: 0.06, nErrors: 6 },
      { teamId: bravoTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'ROUND' as const, roundId: rounds[0].id, mape: 0.11, nErrors: 6 },
      { teamId: bravoTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'ROUND' as const, roundId: rounds[1].id, mape: 0.07, nErrors: 6 },
      { teamId: gammaTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'ROUND' as const, roundId: rounds[0].id, mape: 0.14, nErrors: 6 },
      { teamId: gammaTeam.id, metric: 'OCCUPANCY' as const, scopeType: 'ROUND' as const, roundId: rounds[1].id, mape: 0.12, nErrors: 6 },
    ]

    for (const aggregate of aggregates) {
      await prisma.scoreAggregate.create({
        data: {
          seasonId: season.id,
          teamId: aggregate.teamId,
          metric: aggregate.metric,
          scopeType: aggregate.scopeType,
          roundId: 'roundId' in aggregate ? aggregate.roundId ?? null : null,
          marketId: null,
          mape: aggregate.mape,
          nErrors: aggregate.nErrors,
        },
      })
    }
  })

  it('returns ranked teams for the combined leaderboard metric', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=COMBINED`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard).toHaveLength(3)
    expect(data.leaderboard.map((entry: { teamId: string }) => entry.teamId)).toEqual([
      alphaTeam.id,
      bravoTeam.id,
      gammaTeam.id,
    ])
  })

  it('ranks the team with the lowest combined MAPE first', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=COMBINED`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard[0].teamId).toBe(alphaTeam.id)
    expect(data.leaderboard[0].rank).toBe(1)
  })

  it('populates roundScores for metric-specific leaderboard entries', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()
    const alphaEntry = data.leaderboard.find((entry: { teamId: string }) => entry.teamId === alphaTeam.id)

    expect(res.status).toBe(200)
    expect(Object.keys(alphaEntry.roundScores)).toHaveLength(2)
  })

  it('populates cumulativeScores for metric-specific leaderboard entries', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()
    const alphaEntry = data.leaderboard.find((entry: { teamId: string }) => entry.teamId === alphaTeam.id)

    expect(res.status).toBe(200)
    expect(Object.keys(alphaEntry.cumulativeScores)).toHaveLength(2)
  })

  it('excludes disqualified teams from the leaderboard', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=COMBINED`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard.some((entry: { teamId: string }) => entry.teamId === disqualifiedTeam.id)).toBe(false)
  })

  it('excludes pending-approval teams from the leaderboard', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=COMBINED`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard.some((entry: { teamId: string }) => entry.teamId === pendingTeam.id)).toBe(false)
  })

  it('uses occupancy MAPE as the combined tie-breaker', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=COMBINED`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard[0].teamId).toBe(alphaTeam.id)
    expect(data.leaderboard[1].teamId).toBe(bravoTeam.id)
  })

  it('returns occupancy leaderboard rankings', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard[0].teamId).toBe(alphaTeam.id)
    expect(data.leaderboard[1].teamId).toBe(bravoTeam.id)
  })

  it('returns ADR leaderboard rankings', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=ADR`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard[0].teamId).toBe(bravoTeam.id)
    expect(data.leaderboard[1].teamId).toBe(alphaTeam.id)
  })

  it('allows unauthenticated users to view the public leaderboard payload', async () => {
    logout()
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=COMBINED`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard).toHaveLength(3)
    expect(data.leaderboard.every((entry: { mape: number | null }) => entry.mape === null)).toBe(true)
  })

  it('assigns distinct sorted ranks when MAPE is masked from non-admin viewers', async () => {
    logout()
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=COMBINED`))
    const data = await res.json()

    // Regression: masked (null) MAPE previously collapsed every rank to #1 because
    // `null === entry.mape` matched the first row. Ranks must follow the sorted order.
    expect(res.status).toBe(200)
    expect(data.leaderboard.map((entry: { rank: number }) => entry.rank)).toEqual([1, 2, 3])
  })

  it('shows published leaderboard values and progression to students', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { leaderboardVisible: true },
    })
    await prisma.round.update({
      where: { id: rounds[1].id },
      data: { leaderboardVisible: true },
    })

    await loginAs(student.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()
    const alphaEntry = data.leaderboard.find((entry: { teamId: string }) => entry.teamId === alphaTeam.id)

    expect(res.status).toBe(200)
    expect(alphaEntry.mape).toBeCloseTo(0.08, 5)
    expect(alphaEntry.roundScores[rounds[0].id]).toBeCloseTo(0.1, 5)
    expect(alphaEntry.cumulativeScores[rounds[1].id]).toBeCloseTo(0.08, 5)
  })

  it('keeps unpublished round contributions hidden from students', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { leaderboardVisible: true },
    })
    await prisma.round.update({
      where: { id: rounds[1].id },
      data: { leaderboardVisible: true },
    })

    await prisma.scoreAggregate.create({
      data: {
        seasonId: season.id,
        teamId: alphaTeam.id,
        metric: 'OCCUPANCY',
        scopeType: 'ROUND',
        roundId: rounds[2].id,
        marketId: null,
        mape: 0.3,
        nErrors: 6,
      },
    })

    await prisma.scoreAggregate.updateMany({
      where: {
        seasonId: season.id,
        teamId: alphaTeam.id,
        metric: 'OCCUPANCY',
        scopeType: 'SEASON',
      },
      data: {
        mape: (0.1 + 0.06 + 0.3) / 3,
        nErrors: 18,
      },
    })

    await loginAs(student.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()
    const alphaEntry = data.leaderboard.find((entry: { teamId: string }) => entry.teamId === alphaTeam.id)

    expect(res.status).toBe(200)
    expect(data.leaderboard[0].teamId).toBe(alphaTeam.id)
    expect(alphaEntry.mape).toBeCloseTo(0.08, 5)
  })

  it('narrows leaderboard results by universityId', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(
      makeRequest(`${BASE}/api/leaderboards?metric=COMBINED&universityId=${universityB.id}`)
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.leaderboard).toHaveLength(1)
    expect(data.leaderboard[0].teamId).toBe(gammaTeam.id)
  })

  it('keys round progression by round id and uses rounds metadata for display labels', async () => {
    await loginAs(admin.id)
    const res = await leaderboardHandler(makeRequest(`${BASE}/api/leaderboards?metric=OCCUPANCY`))
    const data = await res.json()
    const alphaEntry = data.leaderboard.find((entry: { teamId: string }) => entry.teamId === alphaTeam.id)

    expect(res.status).toBe(200)
    expect(Object.keys(alphaEntry.roundScores)).toContain(rounds[0].id)
    expect(Object.keys(alphaEntry.cumulativeScores)).toContain(rounds[1].id)
    expect(data.rounds.map((round: { number: number }) => `R${round.number}`)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'])
  })
})
