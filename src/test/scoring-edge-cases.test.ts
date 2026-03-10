import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from './db'
import {
  createUser,
  createUniversity,
  createSeasonWithRounds,
  createMarkets,
  createTeam,
  addTeamMember,
  createSubmission,
  createActual,
} from './fixtures'
import { runScoring, getExpectedPredictions, getTotalExpectedPredictions } from '@/lib/scoring'

describe('Scoring edge cases', () => {
  let adminUser: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    const uni = await createUniversity()
    adminUser = await createUser({ email: 'admin@test.com', role: 'ADMIN', universityId: uni.id })
  })

  it('handles actual=0 and predicted=0 → apeError=0', async () => {
    const { season, rounds } = await createSeasonWithRounds()
    const markets = await createMarkets(season.id)
    const uni = await createUniversity('Edge University')
    const supervisor = await createUser({ email: 'sup@test.com', role: 'SUPERVISOR', universityId: uni.id })
    const student = await createUser({ email: 'student@test.com', role: 'STUDENT', universityId: uni.id })
    const team = await createTeam({ name: 'Edge Team', supervisorId: supervisor.id, universityId: uni.id, seasonId: season.id })
    await addTeamMember(team.id, student.id, true)

    await createSubmission({
      teamId: team.id, roundId: rounds[0].id, submittedById: student.id,
      values: [{ marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 0 }],
    })

    await createActual({
      seasonId: season.id, roundId: rounds[0].id, marketId: markets[0].id,
      metric: 'OCCUPANCY', weekOffset: 1, value: 0, createdById: adminUser.id,
    })

    const result = await runScoring(season.id, adminUser.id)

    expect(result.status).toBe('SUCCESS')
    expect(result.errorsUpserted).toBeGreaterThanOrEqual(1)

    const error = await prisma.predictionError.findFirst({
      where: { teamId: team.id, roundId: rounds[0].id, marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1 },
    })

    expect(error).toBeTruthy()
    expect(error!.absError).toBe(0)
    expect(error!.apeError).toBe(0)
  })

  it('handles actual=0 and predicted!=0 → apeError=null (excluded from MAPE)', async () => {
    const { season, rounds } = await createSeasonWithRounds()
    const markets = await createMarkets(season.id)
    const uni = await createUniversity('Edge University 2')
    const supervisor = await createUser({ email: 'sup2@test.com', role: 'SUPERVISOR', universityId: uni.id })
    const student = await createUser({ email: 'student2@test.com', role: 'STUDENT', universityId: uni.id })
    const team = await createTeam({ name: 'Edge Team 2', supervisorId: supervisor.id, universityId: uni.id, seasonId: season.id })
    await addTeamMember(team.id, student.id, true)

    await createSubmission({
      teamId: team.id, roundId: rounds[0].id, submittedById: student.id,
      values: [{ marketId: markets[0].id, metric: 'ADR', weekOffset: 1, value: 150 }],
    })

    await createActual({
      seasonId: season.id, roundId: rounds[0].id, marketId: markets[0].id,
      metric: 'ADR', weekOffset: 1, value: 0, createdById: adminUser.id,
    })

    const result = await runScoring(season.id, adminUser.id)

    expect(result.status).toBe('SUCCESS')
    expect(result.warnings).toBeDefined()
    expect(result.warnings!.length).toBeGreaterThan(0)

    const error = await prisma.predictionError.findFirst({
      where: { teamId: team.id, roundId: rounds[0].id, marketId: markets[0].id, metric: 'ADR', weekOffset: 1 },
    })

    expect(error).toBeTruthy()
    expect(error!.absError).toBe(150)
    expect(error!.apeError).toBeNull()
  })

  it('scoring with scope=ROUND only scores that round', async () => {
    const { season, rounds } = await createSeasonWithRounds()
    const markets = await createMarkets(season.id)
    const uni = await createUniversity('Scope University')
    const supervisor = await createUser({ email: 'sup3@test.com', role: 'SUPERVISOR', universityId: uni.id })
    const student = await createUser({ email: 'student3@test.com', role: 'STUDENT', universityId: uni.id })
    const team = await createTeam({ name: 'Scope Team', supervisorId: supervisor.id, universityId: uni.id, seasonId: season.id })
    await addTeamMember(team.id, student.id, true)

    await createSubmission({
      teamId: team.id, roundId: rounds[0].id, submittedById: student.id,
      values: [{ marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 70 }],
    })
    await createSubmission({
      teamId: team.id, roundId: rounds[1].id, submittedById: student.id,
      values: [{ marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 75 }],
    })

    await createActual({ seasonId: season.id, roundId: rounds[0].id, marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 65, createdById: adminUser.id })
    await createActual({ seasonId: season.id, roundId: rounds[1].id, marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 72, createdById: adminUser.id })

    const result = await runScoring(season.id, adminUser.id, 'ROUND', rounds[0].id)

    expect(result.status).toBe('SUCCESS')
    expect(result.submissionsProcessed).toBe(1)
  })

  it('scoring when no submissions exist returns SUCCESS with 0 counts', async () => {
    const { season } = await createSeasonWithRounds()
    await createMarkets(season.id)

    const result = await runScoring(season.id, adminUser.id)

    expect(result.status).toBe('SUCCESS')
    expect(result.submissionsProcessed).toBe(0)
    expect(result.errorsUpserted).toBe(0)
    expect(result.aggregatesUpserted).toBe(0)
  })

  it('getExpectedPredictions returns correct count for final round (7)', () => {
    const finalRoundPredictions = getExpectedPredictions(7)
    expect(finalRoundPredictions).toBe(3 * 2 * 1)
  })

  it('getExpectedPredictions returns correct count for non-final round', () => {
    const normalRoundPredictions = getExpectedPredictions(3)
    expect(normalRoundPredictions).toBe(3 * 2 * 2)
  })

  it('getTotalExpectedPredictions sums across all rounds', () => {
    const total = getTotalExpectedPredictions()
    expect(total).toBe((6 * 12) + 6)
  })

  it('re-scoring after actuals update produces correct new values', async () => {
    const { season, rounds } = await createSeasonWithRounds()
    const markets = await createMarkets(season.id)
    const uni = await createUniversity('Rescore University')
    const supervisor = await createUser({ email: 'sup4@test.com', role: 'SUPERVISOR', universityId: uni.id })
    const student = await createUser({ email: 'student4@test.com', role: 'STUDENT', universityId: uni.id })
    const team = await createTeam({ name: 'Rescore Team', supervisorId: supervisor.id, universityId: uni.id, seasonId: season.id })
    await addTeamMember(team.id, student.id, true)

    await createSubmission({
      teamId: team.id, roundId: rounds[0].id, submittedById: student.id,
      values: [{ marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 70 }],
    })

    const actual = await createActual({
      seasonId: season.id, roundId: rounds[0].id, marketId: markets[0].id,
      metric: 'OCCUPANCY', weekOffset: 1, value: 65, createdById: adminUser.id,
    })

    const firstResult = await runScoring(season.id, adminUser.id)
    expect(firstResult.status).toBe('SUCCESS')

    const firstError = await prisma.predictionError.findFirst({
      where: { teamId: team.id, roundId: rounds[0].id, marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1 },
    })
    expect(firstError!.absError).toBe(5)

    await prisma.actual.update({ where: { id: actual.id }, data: { value: 60 } })

    const secondResult = await runScoring(season.id, adminUser.id)
    expect(secondResult.status).toBe('SUCCESS')

    const secondError = await prisma.predictionError.findFirst({
      where: { teamId: team.id, roundId: rounds[0].id, marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1 },
    })
    expect(secondError!.absError).toBe(10)
  })
})
