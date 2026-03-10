import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from './db'
import {
  createUser,
  createUniversity,
  createSeasonWithRounds,
  createTeam,
} from './fixtures'
import { loginAs, logout } from './auth'
import { makeRequest } from './http'
import { GET, POST } from '@/app/api/teams/route'

describe('Teams API', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let admin: Awaited<ReturnType<typeof createUser>>
  let student: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    university = await createUniversity('API Test University')
    supervisor = await createUser({ email: 'sup@teams.test', role: 'SUPERVISOR', universityId: university.id })
    admin = await createUser({ email: 'admin@teams.test', role: 'ADMIN', universityId: university.id })
    student = await createUser({ email: 'student@teams.test', role: 'STUDENT', universityId: university.id })
  })

  describe('GET /api/teams', () => {
    it('as supervisor returns only their teams', async () => {
      const { season } = await createSeasonWithRounds()
      const otherUni = await createUniversity('Other University')
      const otherSup = await createUser({ email: 'other@teams.test', role: 'SUPERVISOR', universityId: otherUni.id })

      await createTeam({ name: 'My Team', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id })
      await createTeam({ name: 'Other Team', supervisorId: otherSup.id, universityId: otherUni.id, seasonId: season.id })

      await loginAs(supervisor.id)
      const req = makeRequest('http://localhost/api/teams')
      const res = await GET()
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.teams).toHaveLength(1)
      expect(data.teams[0].name).toBe('My Team')
    })

    it('as admin returns all teams', async () => {
      const { season } = await createSeasonWithRounds()
      await createTeam({ name: 'Team A', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id })
      await createTeam({ name: 'Team B', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id })

      await loginAs(admin.id)
      const res = await GET()
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.teams.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('POST /api/teams', () => {
    it('as supervisor creates a team', async () => {
      await createSeasonWithRounds()
      await loginAs(supervisor.id)

      const req = makeRequest('http://localhost/api/teams', {
        method: 'POST',
        body: { name: 'New Test Team' },
      })
      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(201)
      expect(data.team.name).toBe('New Test Team')
      expect(data.team.supervisorId).toBe(supervisor.id)
    })

    it('with duplicate name returns 422', async () => {
      await createSeasonWithRounds()
      await createTeam({ name: 'Duplicate Name', supervisorId: supervisor.id, universityId: university.id })

      await loginAs(supervisor.id)
      const req = makeRequest('http://localhost/api/teams', {
        method: 'POST',
        body: { name: 'Duplicate Name' },
      })
      const res = await POST(req)

      expect(res.status).toBe(422)
    })

    it('when supervisor has 10 teams returns 422', async () => {
      await createSeasonWithRounds()

      for (let i = 0; i < 10; i++) {
        await createTeam({
          name: `Team ${i}`,
          displayId: `T-${Date.now()}-${i}`,
          supervisorId: supervisor.id,
          universityId: university.id,
        })
      }

      await loginAs(supervisor.id)
      const req = makeRequest('http://localhost/api/teams', {
        method: 'POST',
        body: { name: 'Team Eleven' },
      })
      const res = await POST(req)

      expect(res.status).toBe(422)
    })

    it('with no active season returns 422', async () => {
      await loginAs(supervisor.id)
      const req = makeRequest('http://localhost/api/teams', {
        method: 'POST',
        body: { name: 'No Season Team' },
      })
      const res = await POST(req)

      expect(res.status).toBe(422)
    })

    it('as student returns 403', async () => {
      await createSeasonWithRounds()
      await loginAs(student.id)

      const req = makeRequest('http://localhost/api/teams', {
        method: 'POST',
        body: { name: 'Student Team' },
      })
      const res = await POST(req)

      expect(res.status).toBe(403)
    })
  })
})
