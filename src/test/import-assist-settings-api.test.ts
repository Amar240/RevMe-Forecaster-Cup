import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from './db'
import { loginAs } from './auth'
import { createSeasonWithRounds, createUser } from './fixtures'
import { GET, PATCH } from '@/app/api/admin/seasons/[seasonId]/import-assist/route'

describe('season import assist settings API', () => {
  let seasonId: string
  let adminId: string
  beforeEach(async () => {
    vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'true')
    seasonId = (await createSeasonWithRounds({ name: 'AI Control Season' })).season.id
    adminId = (await createUser({ email: 'ai-admin@example.edu', role: 'ADMIN' })).id
    await loginAs(adminId)
  })

  it('is disabled by default and full admins can enable it with an audit record', async () => {
    const initial = await GET(new NextRequest('http://localhost'), { params: { seasonId } })
    expect(await initial.json()).toMatchObject({ mode: 'DISABLED', infrastructureAvailable: true, effective: false })
    const response = await PATCH(new NextRequest('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'ON_DEMAND' }) }), { params: { seasonId } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ mode: 'ON_DEMAND', effective: true })
    expect(await prisma.auditLog.findFirst({ where: { action: 'IMPORT_ASSIST_MODE_CHANGED', entityId: seasonId } })).toBeTruthy()
  })

  it('rejects enabling while the deployment switch is off and excludes sub-admins', async () => {
    vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'false')
    expect((await PATCH(new NextRequest('http://localhost', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'ON_DEMAND' }) }), { params: { seasonId } })).status).toBe(409)
    const subAdmin = await createUser({ email: 'ai-subadmin@example.edu', role: 'SUB_ADMIN', hasFullAccess: true })
    await loginAs(subAdmin.id)
    expect((await GET(new NextRequest('http://localhost'), { params: { seasonId } })).status).toBe(403)
  })
})
