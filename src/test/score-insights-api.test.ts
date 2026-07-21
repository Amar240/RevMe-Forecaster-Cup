import { beforeEach, describe, expect, it } from 'vitest'
import { GET as insights } from '@/app/api/scores/insights/route'
import { GET as trends } from '@/app/api/scores/trends/route'
import { prisma } from './db'
import { loginAs } from './auth'
import { addTeamMember, createMarkets, createSeasonWithRounds, createTeam, createUniversity, createUser } from './fixtures'
import { makeRequest } from './http'

describe('score insights team scoping', () => {
  let ownerId: string
  let studentId: string
  let teamId: string
  let otherTeamId: string

  beforeEach(async () => {
    const university = await createUniversity('Score Insights University')
    const { season, rounds } = await createSeasonWithRounds({ name: 'Score Insights Season' })
    await prisma.round.update({ where: { id: rounds[0].id }, data: { leaderboardVisible: true } })
    ownerId = (await createUser({ email: 'owner@scores.test', role: 'SUPERVISOR', universityId: university.id })).id
    const otherOwner = await createUser({ email: 'other@scores.test', role: 'SUPERVISOR', universityId: university.id })
    studentId = (await createUser({ email: 'student@scores.test', role: 'STUDENT', universityId: university.id })).id
    teamId = (await createTeam({ name: 'Score Team', supervisorId: ownerId, universityId: university.id, seasonId: season.id })).id
    otherTeamId = (await createTeam({ name: 'Other Score Team', supervisorId: otherOwner.id, universityId: university.id, seasonId: season.id })).id
    await addTeamMember(teamId, studentId)
    const [market] = await createMarkets(season.id)
    for (const target of [teamId, otherTeamId]) {
      await prisma.scoreAggregate.createMany({ data: ['OCCUPANCY', 'ADR'].map((metric, index) => ({ seasonId: season.id, teamId: target, roundId: rounds[0].id, scopeType: 'ROUND' as const, metric: metric as 'OCCUPANCY' | 'ADR', mape: target === teamId ? 0.1 + index * 0.02 : 0.2 + index * 0.02, nErrors: 1 })) })
      await prisma.predictionError.create({ data: { seasonId: season.id, teamId: target, roundId: rounds[0].id, marketId: market.id, metric: 'ADR', weekOffset: 1, predictedValue: 110, actualValue: 100, absError: 10, apeError: 0.1 } })
    }
  })

  it('returns shared insight datasets for a student team', async () => {
    await loginAs(studentId)
    const response = await insights(makeRequest('http://localhost/api/scores/insights'))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.insights).toMatchObject({ horizon: { week1: 0.1 }, markets: [{ marketName: 'Nashville CBD', mape: 0.1 }] })
    expect(data.insights.cohortBands[0]).toMatchObject({ round: 1, team: 0.11 })
  })

  it('allows supervisors to select only their own teams', async () => {
    await loginAs(ownerId)
    expect((await trends(makeRequest(`http://localhost/api/scores/trends?teamId=${teamId}`))).status).toBe(200)
    expect((await trends(makeRequest(`http://localhost/api/scores/trends?teamId=${otherTeamId}`))).status).toBe(403)
  })
})
