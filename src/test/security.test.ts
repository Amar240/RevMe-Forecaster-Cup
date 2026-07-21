import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from './db'
import { loginAs, logout } from './auth'
import { makeRequest } from './http'
import {
  addTeamMember,
  createMarkets,
  createSeasonWithRounds,
  createSubmission,
  createTeam,
  createUniversity,
  createUser,
  grantPermission,
} from './fixtures'

import { middleware } from '@/middleware'
import { GET as getAdminTeamsHandler } from '@/app/api/admin/teams/route'
import { GET as getAdminUsersHandler } from '@/app/api/admin/users/route'
import { POST as runScoringHandler } from '@/app/api/admin/scoring/run/route'
import { GET as getAuditLogsHandler } from '@/app/api/admin/audit-logs/route'
import { GET as getTeamsHandler } from '@/app/api/teams/route'
import { GET as submissionHistoryHandler } from '@/app/api/submissions/history/route'
import { GET as currentSubmissionHandler } from '@/app/api/submissions/current/route'

const BASE = 'http://localhost:3000'

function makeMiddlewareRequest(
  pathname: string,
  options: {
    method?: string
    csrfToken?: string
    cookieToken?: string
    origin?: string | null
    referer?: string | null
  } = {}
) {
  const origin = options.origin === undefined ? BASE : options.origin
  const referer = options.referer === undefined ? (origin ? `${origin}/dashboard` : null) : options.referer
  const headers = new Headers()
  if (origin) {
    headers.set('origin', origin)
  }
  if (referer) {
    headers.set('referer', referer)
  }

  if (options.csrfToken) {
    headers.set('x-csrf-token', options.csrfToken)
  }
  if (options.cookieToken) {
    headers.set('cookie', `revme_csrf=${options.cookieToken}`)
  }

  return new NextRequest(`${BASE}${pathname}`, {
    method: options.method ?? 'GET',
    headers,
  })
}

describe('Security boundaries', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let rounds: Awaited<ReturnType<typeof createSeasonWithRounds>>['rounds']
  let markets: Awaited<ReturnType<typeof createMarkets>>
  let admin: Awaited<ReturnType<typeof createUser>>
  let subAdmin: Awaited<ReturnType<typeof createUser>>
  let supervisorA: Awaited<ReturnType<typeof createUser>>
  let supervisorB: Awaited<ReturnType<typeof createUser>>
  let studentA: Awaited<ReturnType<typeof createUser>>
  let studentB: Awaited<ReturnType<typeof createUser>>
  let teamA: Awaited<ReturnType<typeof createTeam>>
  let teamB: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await createUniversity('Security University')
    const seasonBundle = await createSeasonWithRounds({ status: 'ACTIVE', name: 'Security Season' })
    season = seasonBundle.season
    rounds = seasonBundle.rounds
    markets = await createMarkets(season.id)

    admin = await createUser({ email: 'admin@security.test', role: 'ADMIN', universityId: university.id })
    subAdmin = await createUser({
      email: 'sub-admin@security.test',
      role: 'SUB_ADMIN',
      universityId: university.id,
      hasFullAccess: false,
    })
    supervisorA = await createUser({
      email: 'supervisor-a@security.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    supervisorB = await createUser({
      email: 'supervisor-b@security.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    studentA = await createUser({
      email: 'student-a@security.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    studentB = await createUser({
      email: 'student-b@security.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    teamA = await createTeam({
      name: 'Security Team A',
      supervisorId: supervisorA.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    teamB = await createTeam({
      name: 'Security Team B',
      supervisorId: supervisorB.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await addTeamMember(teamA.id, studentA.id, true)
    await addTeamMember(teamB.id, studentB.id, true)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('blocks students from representative admin routes', async () => {
    await loginAs(studentA.id)

    const teamsRes = await getAdminTeamsHandler(makeRequest(`${BASE}/api/admin/teams`))
    const usersRes = await getAdminUsersHandler()
    const scoringRes = await runScoringHandler(
      makeRequest(`${BASE}/api/admin/scoring/run`, {
        method: 'POST',
        body: { seasonId: season.id, scope: 'SEASON' },
      })
    )
    const auditRes = await getAuditLogsHandler(makeRequest(`${BASE}/api/admin/audit-logs`))

    expect(teamsRes.status).toBe(403)
    expect(usersRes.status).toBe(403)
    expect(scoringRes.status).toBe(403)
    expect(auditRes.status).toBe(403)
  })

  it('blocks supervisors from restricted admin routes', async () => {
    await loginAs(supervisorA.id)

    const usersRes = await getAdminUsersHandler()
    const scoringRes = await runScoringHandler(
      makeRequest(`${BASE}/api/admin/scoring/run`, {
        method: 'POST',
        body: { seasonId: season.id, scope: 'SEASON' },
      })
    )

    expect(usersRes.status).toBe(403)
    expect(scoringRes.status).toBe(403)
  })

  it('scopes GET /api/teams to the authenticated supervisor only', async () => {
    await loginAs(supervisorA.id)
    const res = await getTeamsHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.teams.map((team: { id: string }) => team.id)).toContain(teamA.id)
    expect(data.teams.map((team: { id: string }) => team.id)).not.toContain(teamB.id)
  })

  it('keeps student submission history scoped to their own team', async () => {
    await createSubmission({
      teamId: teamA.id,
      roundId: rounds[0].id,
      submittedById: studentA.id,
      values: markets.flatMap((market) => [
        { marketId: market.id, metric: 'OCCUPANCY' as const, weekOffset: 1, value: 70 },
        { marketId: market.id, metric: 'ADR' as const, weekOffset: 1, value: 170 },
        { marketId: market.id, metric: 'OCCUPANCY' as const, weekOffset: 2, value: 71 },
        { marketId: market.id, metric: 'ADR' as const, weekOffset: 2, value: 171 },
      ]),
    })
    await createSubmission({
      teamId: teamB.id,
      roundId: rounds[0].id,
      submittedById: studentB.id,
      values: markets.flatMap((market) => [
        { marketId: market.id, metric: 'OCCUPANCY' as const, weekOffset: 1, value: 80 },
        { marketId: market.id, metric: 'ADR' as const, weekOffset: 1, value: 180 },
        { marketId: market.id, metric: 'OCCUPANCY' as const, weekOffset: 2, value: 81 },
        { marketId: market.id, metric: 'ADR' as const, weekOffset: 2, value: 181 },
      ]),
    })

    await loginAs(studentA.id)
    const res = await submissionHistoryHandler(makeRequest('http://localhost:5000/api/submissions/history'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.submissions).toHaveLength(6)
    expect(data.submissions.every((entry: { occupancy: number }) => entry.occupancy < 80)).toBe(true)
  })

  it('blocks unauthenticated users from representative dashboard APIs', async () => {
    logout()

    const teamsRes = await getTeamsHandler()
    const currentRes = await currentSubmissionHandler()
    const adminTeamsRes = await getAdminTeamsHandler(makeRequest(`${BASE}/api/admin/teams`))

    expect(teamsRes.status).toBe(401)
    expect(currentRes.status).toBe(401)
    expect(adminTeamsRes.status).toBe(401)
  })

  it('requires a CSRF token for unsafe API requests in middleware', async () => {
    const request = makeMiddlewareRequest('/api/teams/csrf-check', {
      method: 'POST',
    })

    const response = middleware(request)
    expect(response.status).toBe(403)
  })

  it('accepts rev-me.org as a valid unsafe request origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://rev-me.org')
    const csrfToken = 'csrf-rev-me-org'

    const response = middleware(
      makeMiddlewareRequest('/api/auth/register', {
        method: 'POST',
        origin: 'https://rev-me.org',
        csrfToken,
        cookieToken: csrfToken,
      })
    )

    expect(response.status).toBe(200)
  })

  it('accepts www.rev-me.org as a valid unsafe request origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://rev-me.org')
    const csrfToken = 'csrf-www-rev-me-org'

    const response = middleware(
      makeMiddlewareRequest('/api/auth/register', {
        method: 'POST',
        origin: 'https://www.rev-me.org',
        csrfToken,
        cookieToken: csrfToken,
      })
    )

    expect(response.status).toBe(200)
  })

  it('accepts a missing origin when referer resolves to an allowed origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://rev-me.org')
    const csrfToken = 'csrf-referer-fallback'

    const response = middleware(
      makeMiddlewareRequest('/api/auth/register', {
        method: 'POST',
        origin: null,
        referer: 'https://www.rev-me.org/register',
        csrfToken,
        cookieToken: csrfToken,
      })
    )

    expect(response.status).toBe(200)
  })

  it('rejects an invalid external origin for unsafe requests', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://rev-me.org')
    const csrfToken = 'csrf-invalid-origin'

    const response = middleware(
      makeMiddlewareRequest('/api/auth/register', {
        method: 'POST',
        origin: 'https://evil.example.com',
        referer: 'https://evil.example.com/register',
        csrfToken,
        cookieToken: csrfToken,
      })
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ message: 'Invalid origin' })
  })

  it('returns 429 from middleware after exceeding the rate limit', async () => {
    const csrfToken = 'security-rate-limit'

    let response = middleware(
      makeMiddlewareRequest('/api/auth/login', {
        method: 'POST',
        csrfToken,
        cookieToken: csrfToken,
      })
    )

    for (let attempt = 1; attempt < 11; attempt += 1) {
      response = middleware(
        makeMiddlewareRequest('/api/auth/login', {
          method: 'POST',
          csrfToken,
          cookieToken: csrfToken,
        })
      )
    }

    expect(response.status).toBe(429)
  })

  it('blocks a sub-admin without permission from restricted routes', async () => {
    await loginAs(subAdmin.id)

    const res = await getAdminUsersHandler()
    expect(res.status).toBe(403)
  })

  it('allows a sub-admin with the correct permission on that route', async () => {
    await grantPermission(subAdmin.id, 'users:manage', admin.id)
    await loginAs(subAdmin.id)

    const res = await getAdminUsersHandler()
    expect(res.status).toBe(200)
  })

  it('allows admins on representative admin routes', async () => {
    await loginAs(admin.id)

    const teamsRes = await getAdminTeamsHandler(makeRequest(`${BASE}/api/admin/teams`))
    const usersRes = await getAdminUsersHandler()
    const auditRes = await getAuditLogsHandler(makeRequest(`${BASE}/api/admin/audit-logs`))
    const scoringRes = await runScoringHandler(
      makeRequest(`${BASE}/api/admin/scoring/run`, {
        method: 'POST',
        body: { seasonId: season.id, scope: 'SEASON' },
      })
    )

    expect(teamsRes.status).toBe(200)
    expect(usersRes.status).toBe(200)
    expect(auditRes.status).toBe(200)
    expect(scoringRes.status).toBe(200)
  })
})
