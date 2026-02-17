import { describe, expect, it } from 'vitest'
import { loginAs } from './auth'
import { prisma } from './db'
import { makeRequest } from './http'
import { createMarkets, createSeasonWithRounds, createTeam, createUniversity, createUser, addTeamMember } from './fixtures'
import { POST as submitForecast } from '@/app/api/submissions/route'

describe('Round gating and locked submissions', () => {
  it('rejects submission when round is not open', async () => {
    const uni = await createUniversity()
    const supervisor = await createUser({ email: 'sup@t.com', role: 'SUPERVISOR', universityId: uni.id })
    const student = await createUser({ email: 'student@t.com', role: 'STUDENT', universityId: uni.id })
    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await createMarkets(season.id)

    const team = await createTeam({
      supervisorId: supervisor.id,
      universityId: uni.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(team.id, student.id, true)

    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'UPCOMING' },
    })

    await loginAs(student.id)
    const req = makeRequest('http://localhost/api/submissions', {
      method: 'POST',
      body: { roundId: rounds[0].id, submissions: [] },
    })
    const res = await submitForecast(req)
    expect(res.status).toBe(400)
  })

  it('accepts submission when round is open and locks subsequent submissions', async () => {
    const uni = await createUniversity()
    const supervisor = await createUser({ email: 'sup2@t.com', role: 'SUPERVISOR', universityId: uni.id })
    const student = await createUser({ email: 'student2@t.com', role: 'STUDENT', universityId: uni.id })
    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const markets = await createMarkets(season.id)

    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'OPEN', closesAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    })

    const team = await createTeam({
      supervisorId: supervisor.id,
      universityId: uni.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(team.id, student.id, true)

    const submissions = markets.flatMap((market) => [
      { marketId: market.id, weekOffset: 1, occupancy: 70, adr: 150 },
      { marketId: market.id, weekOffset: 2, occupancy: 72, adr: 155 },
    ])

    await loginAs(student.id)
    const req = makeRequest('http://localhost/api/submissions', {
      method: 'POST',
      body: { roundId: rounds[0].id, submissions },
    })
    const res = await submitForecast(req)
    expect(res.status).toBe(201)

    const req2 = makeRequest('http://localhost/api/submissions', {
      method: 'POST',
      body: { roundId: rounds[0].id, submissions },
    })
    const res2 = await submitForecast(req2)
    expect(res2.status).toBe(409)
  })
})
