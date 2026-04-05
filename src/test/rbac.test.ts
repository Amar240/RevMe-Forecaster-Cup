import { describe, expect, it } from 'vitest'
import { makeRequest } from './http'
import { loginAs } from './auth'
import { createUniversity, createUser, grantPermission } from './fixtures'
import { prisma } from './db'

import { GET as getAdminTeams } from '@/app/api/admin/teams/route'
import { GET as getAuditLogs } from '@/app/api/admin/audit-logs/route'

describe('RBAC enforcement', () => {
  it('blocks student from admin routes', async () => {
    const uni = await createUniversity()
    const student = await createUser({ email: 'student@test.com', role: 'STUDENT', universityId: uni.id })
    await loginAs(student.id)

    const res = await getAdminTeams(makeRequest('http://localhost/api/admin/teams'))
    expect(res.status).toBe(403)
  })

  it('blocks supervisor from admin routes', async () => {
    const uni = await createUniversity()
    const supervisor = await createUser({ email: 'sup@test.com', role: 'SUPERVISOR', universityId: uni.id })
    await loginAs(supervisor.id)

    const res = await getAdminTeams(makeRequest('http://localhost/api/admin/teams'))
    expect(res.status).toBe(403)
  })

  it('allows admin on admin routes', async () => {
    const admin = await createUser({ email: 'admin@test.com', role: 'ADMIN' })
    await loginAs(admin.id)

    const res = await getAdminTeams(makeRequest('http://localhost/api/admin/teams'))
    expect(res.status).toBe(200)
  })

  it('sub-admin can access only allowed permissions', async () => {
    const admin = await createUser({ email: 'admin2@test.com', role: 'ADMIN' })
    const subAdmin = await createUser({ email: 'sub@test.com', role: 'SUB_ADMIN', hasFullAccess: false })
    await grantPermission(subAdmin.id, 'audit:view', admin.id)

    await loginAs(subAdmin.id)
    const allowed = await getAuditLogs(makeRequest('http://localhost/api/admin/audit-logs'))
    expect(allowed.status).toBe(200)

    const forbidden = await getAdminTeams(makeRequest('http://localhost/api/admin/teams'))
    expect(forbidden.status).toBe(403)
  })
})
