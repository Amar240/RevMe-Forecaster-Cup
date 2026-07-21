import { beforeEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/debrief/[roundId]/route'
import { prisma } from './db'
import { loginAs } from './auth'
import { addTeamMember, createMarkets, createSeasonWithRounds, createTeam, createUniversity, createUser } from './fixtures'
import { makeRequest } from './http'

describe('debrief API authorization and visibility', () => {
  let roundId: string
  let teamId: string
  let otherTeamId: string
  let studentId: string
  let supervisorId: string
  let otherSupervisorId: string

  beforeEach(async () => {
    const university = await createUniversity('Debrief University')
    const seasonBundle = await createSeasonWithRounds({ name: 'Debrief Season' })
    roundId = seasonBundle.rounds[0].id
    supervisorId = (await createUser({ email: 'owner@debrief.test', role: 'SUPERVISOR', universityId: university.id })).id
    otherSupervisorId = (await createUser({ email: 'other@debrief.test', role: 'SUPERVISOR', universityId: university.id })).id
    studentId = (await createUser({ email: 'student@debrief.test', role: 'STUDENT', universityId: university.id })).id
    teamId = (await createTeam({ name: 'Owner Team', supervisorId, universityId: university.id, seasonId: seasonBundle.season.id })).id
    otherTeamId = (await createTeam({ name: 'Other Team', supervisorId: otherSupervisorId, universityId: university.id, seasonId: seasonBundle.season.id })).id
    await addTeamMember(teamId, studentId)
    const [market] = await createMarkets(seasonBundle.season.id)
    for (const targetTeamId of [teamId, otherTeamId]) {
      await prisma.scoreAggregate.createMany({ data: ['OCCUPANCY', 'ADR'].map((metric) => ({ seasonId: seasonBundle.season.id, teamId: targetTeamId, roundId, scopeType: 'ROUND' as const, metric: metric as 'OCCUPANCY' | 'ADR', mape: targetTeamId === teamId ? 0.1 : 0.2, nErrors: 1 })) })
      await prisma.predictionError.create({ data: { seasonId: seasonBundle.season.id, teamId: targetTeamId, roundId, marketId: market.id, metric: 'ADR', weekOffset: 1, predictedValue: 110, actualValue: 100, absError: 10, apeError: targetTeamId === teamId ? 0.1 : 0.2 } })
    }
  })

  const request = (teamId?: string) => makeRequest(`http://localhost/api/debriefs/${roundId}${teamId ? `?teamId=${teamId}` : ''}`)
  const params = () => ({ params: Promise.resolve({ roundId }) })

  it('allows a student to read only their current-season team debrief', async () => {
    await prisma.round.update({ where: { id: roundId }, data: { leaderboardVisible: true } })
    await loginAs(studentId)
    const own = await GET(request(), params())
    expect(own.status).toBe(200)
    expect((await own.json()).debrief.rows[0].cohortMedianError).toBeCloseTo(0.15)
    expect((await GET(request(otherTeamId), params())).status).toBe(404)
  })

  it('scopes supervisors to teams they own', async () => {
    await prisma.round.update({ where: { id: roundId }, data: { leaderboardVisible: true } })
    await loginAs(supervisorId)
    expect((await GET(request(teamId), params())).status).toBe(200)
    expect((await GET(request(otherTeamId), params())).status).toBe(404)
  })

  it('denies unpublished debriefs for every role', async () => {
    await loginAs(studentId)
    expect((await GET(request(), params())).status).toBe(404)
  })
})
