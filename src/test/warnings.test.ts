import { describe, expect, it } from 'vitest'
import { loginAs } from './auth'
import { prisma } from './db'
import { createMarkets, createSeasonWithRounds, createTeam, createUniversity, createUser, addTeamMember } from './fixtures'
import { POST as runWarnings } from '@/app/api/admin/warnings/run/route'
import { POST as submitForecast } from '@/app/api/submissions/route'
import { makeRequest } from './http'

describe('Warnings and disqualification', () => {
  it('disqualifies team after 3 missed submissions', async () => {
    const admin = await createUser({ email: 'admin@t.com', role: 'ADMIN' })
    const uni = await createUniversity()
    const supervisor = await createUser({ email: 'sup@warn.com', role: 'SUPERVISOR', universityId: uni.id })
    const student = await createUser({ email: 'student@warn.com', role: 'STUDENT', universityId: uni.id })
    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await createMarkets(season.id)

    const team = await createTeam({
      supervisorId: supervisor.id,
      universityId: uni.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(team.id, student.id, true)

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    for (const r of rounds.slice(0, 3)) {
      await prisma.round.update({ where: { id: r.id }, data: { status: 'CLOSED', closesAt: past } })
    }

    await prisma.round.update({
      where: { id: rounds[3].id },
      data: {
        status: 'OPEN',
        opensAt: new Date(Date.now() - 60 * 1000),
        closesAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    await loginAs(admin.id)
    const res = await runWarnings()
    expect(res.status).toBe(200)

    const warningCount = await prisma.warning.count({ where: { teamId: team.id } })
    expect(warningCount).toBe(3)

    const updatedTeam = await prisma.team.findUnique({ where: { id: team.id } })
    expect(updatedTeam?.status).toBe('DISQUALIFIED')

    await loginAs(student.id)
    const req = makeRequest('http://localhost/api/submissions', {
      method: 'POST',
      body: { roundId: rounds[3].id, submissions: [] },
    })
    const submitRes = await submitForecast(req)
    expect(submitRes.status).toBe(403)
  })
})
