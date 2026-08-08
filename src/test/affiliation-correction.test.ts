import { describe, expect, it } from 'vitest'
import { loginAs } from './auth'
import { prisma } from './db'
import { createTeam, createUniversity, createUser } from './fixtures'
import { makeRequest } from './http'
import { GET as getMe } from '@/app/api/users/me/route'
import { PATCH as correctAffiliation } from '@/app/api/users/me/affiliation/route'

describe('supervisor self-service affiliation correction', () => {
  it('allows a dependency-free supervisor to correct their listed university', async () => {
    const source = await createUniversity('Self Correction Source')
    const target = await createUniversity('Self Correction Target')
    const supervisor = await createUser({ email: 'self-correct@revme.test', role: 'SUPERVISOR', universityId: source.id })
    await loginAs(supervisor.id)

    const before = await getMe()
    expect((await before.json()).user.affiliationCorrection).toMatchObject({ eligible: true, blockers: [] })

    const response = await correctAffiliation(makeRequest('http://localhost/api/users/me/affiliation', {
      method: 'PATCH',
      body: {
        targetUniversityId: target.id,
        universityConfirmed: true,
        reason: 'Selected the wrong university during registration',
      },
    }))
    expect(response.status).toBe(200)
    expect((await prisma.user.findUnique({ where: { id: supervisor.id } }))?.universityId).toBe(target.id)
    expect(await prisma.auditLog.findFirst({ where: { entityId: supervisor.id, action: 'SUPERVISOR_SELF_AFFILIATION_CORRECTED' } })).not.toBeNull()
  })

  it('blocks self-correction after any team has been linked', async () => {
    const source = await createUniversity('Blocked Correction Source')
    const target = await createUniversity('Blocked Correction Target')
    const supervisor = await createUser({ email: 'blocked-self-correct@revme.test', role: 'SUPERVISOR', universityId: source.id })
    await createTeam({ name: 'Historical Link', supervisorId: supervisor.id, universityId: source.id, status: 'ARCHIVED' })
    await loginAs(supervisor.id)

    const before = await getMe()
    const eligibility = (await before.json()).user.affiliationCorrection
    expect(eligibility.eligible).toBe(false)
    expect(eligibility.blockers.map((blocker: { code: string }) => blocker.code)).toContain('TEAMS')

    const response = await correctAffiliation(makeRequest('http://localhost/api/users/me/affiliation', {
      method: 'PATCH',
      body: { targetUniversityId: target.id, universityConfirmed: true, reason: 'Trying a blocked correction' },
    }))
    expect(response.status).toBe(409)
    expect((await prisma.user.findUnique({ where: { id: supervisor.id } }))?.universityId).toBe(source.id)
  })

  it('requires explicit server-side university confirmation', async () => {
    const source = await createUniversity('Confirmation Source')
    const target = await createUniversity('Confirmation Target')
    const supervisor = await createUser({ email: 'confirm-self-correct@revme.test', role: 'SUPERVISOR', universityId: source.id })
    await loginAs(supervisor.id)
    const response = await correctAffiliation(makeRequest('http://localhost/api/users/me/affiliation', {
      method: 'PATCH',
      body: { targetUniversityId: target.id, reason: 'Confirmation is intentionally missing' },
    }))
    expect(response.status).toBe(400)
  })
})
