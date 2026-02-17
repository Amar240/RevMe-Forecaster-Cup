import { describe, expect, it } from 'vitest'
import { loginAs } from './auth'
import { prisma } from './db'
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

import { POST as runScoring } from '@/app/api/admin/scoring/run/route'
import { GET as getLeaderboards } from '@/app/api/leaderboards/route'

describe('Scoring correctness and leaderboards', () => {
  it('computes 78 errors and correct MAPE with 7-round rules', async () => {
    const admin = await createUser({ email: 'admin@score.com', role: 'ADMIN' })
    const uni = await createUniversity('Score Uni')
    const supervisor = await createUser({
      email: 'sup@score.com',
      role: 'SUPERVISOR',
      universityId: uni.id,
    })
    const student = await createUser({
      email: 'student@score.com',
      role: 'STUDENT',
      universityId: uni.id,
    })

    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const markets = await createMarkets(season.id)

    const team = await createTeam({
      supervisorId: supervisor.id,
      universityId: uni.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(team.id, student.id, true)

    for (const round of rounds) {
      const weekOffsets = round.isFinal ? [1] : [1, 2]

      for (const market of markets) {
        for (const weekOffset of weekOffsets) {
          await createActual({
            seasonId: season.id,
            roundId: round.id,
            marketId: market.id,
            metric: 'OCCUPANCY',
            weekOffset,
            value: 100,
            createdById: admin.id,
          })
          await createActual({
            seasonId: season.id,
            roundId: round.id,
            marketId: market.id,
            metric: 'ADR',
            weekOffset,
            value: 200,
            createdById: admin.id,
          })
        }
      }

      const values = markets.flatMap((market) =>
        weekOffsets.flatMap((weekOffset) => [
          { marketId: market.id, metric: 'OCCUPANCY' as const, weekOffset, value: 110 },
          { marketId: market.id, metric: 'ADR' as const, weekOffset, value: 220 },
        ])
      )

      await createSubmission({
        teamId: team.id,
        roundId: round.id,
        submittedById: student.id,
        values,
      })
    }

    await loginAs(admin.id)
    const scoreReq = makeRequest('http://localhost/api/admin/scoring/run', {
      method: 'POST',
      body: { seasonId: season.id, scope: 'SEASON' },
    })
    const scoreRes = await runScoring(scoreReq)
    expect(scoreRes.status).toBe(200)

    const errors = await prisma.predictionError.findMany({
      where: { seasonId: season.id, teamId: team.id },
    })
    expect(errors.length).toBe(78)

    const sampleError = await prisma.predictionError.findFirst({
      where: {
        seasonId: season.id,
        teamId: team.id,
        metric: 'OCCUPANCY',
        roundId: rounds[0].id,
        marketId: markets[0].id,
        weekOffset: 1,
      },
    })

    expect(sampleError?.absError).toBe(10)
    expect(sampleError?.apeError).toBeCloseTo(0.1, 5)

    const occupancyAgg = await prisma.scoreAggregate.findFirst({
      where: {
        seasonId: season.id,
        teamId: team.id,
        metric: 'OCCUPANCY',
        scopeType: 'SEASON',
      },
    })

    const adrAgg = await prisma.scoreAggregate.findFirst({
      where: {
        seasonId: season.id,
        teamId: team.id,
        metric: 'ADR',
        scopeType: 'SEASON',
      },
    })

    expect(occupancyAgg?.nErrors).toBe(39)
    expect(adrAgg?.nErrors).toBe(39)
    expect(occupancyAgg?.mape).toBeCloseTo(0.1, 5)
    expect(adrAgg?.mape).toBeCloseTo(0.1, 5)

    await loginAs(admin.id)
    const adminReq = makeRequest('http://localhost/api/leaderboards?metric=OCCUPANCY')
    const adminRes = await getLeaderboards(adminReq)
    const adminJson = await adminRes.json()

    expect(adminJson.expectedErrors).toBe(78)
    expect(adminJson.leaderboard[0].mape).toBeCloseTo(0.1, 5)
    expect(adminJson.leaderboard[0].nErrors).toBe(39)

    await loginAs(student.id)
    const studentReq = makeRequest('http://localhost/api/leaderboards?metric=OCCUPANCY')
    const studentRes = await getLeaderboards(studentReq)
    const studentJson = await studentRes.json()

    expect(studentJson.leaderboard[0].mape).toBeNull()
    expect(studentJson.leaderboard[0].nErrors).toBeNull()
  })
})
