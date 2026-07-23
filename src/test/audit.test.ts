import { describe, it, expect } from 'vitest'
import { prisma } from './db'
import { createUser, createUniversity } from './fixtures'
import { logAuditAction } from '@/lib/audit'

describe('Audit logging', () => {
  it('logAuditAction creates an AuditLog row', async () => {
    const uni = await createUniversity('Audit University')
    const user = await createUser({ email: 'audit@test.com', role: 'ADMIN', universityId: uni.id })

    await logAuditAction(user.id, 'TEST_ACTION', 'User', user.id, { reason: 'unit test' })

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'TEST_ACTION' },
    })

    expect(log).toBeTruthy()
    expect(log!.entityType).toBe('User')
    expect(log!.entityId).toBe(user.id)
  })

  it('logAuditAction stores before/after JSON correctly', async () => {
    const uni = await createUniversity('Audit University 2')
    const user = await createUser({ email: 'audit2@test.com', role: 'ADMIN', universityId: uni.id })

    const details = {
      before: { role: 'STUDENT' },
      after: { role: 'SUPERVISOR' },
      reason: 'promotion',
    }

    await logAuditAction(user.id, 'ROLE_CHANGE', 'User', 'target-user-id', details)

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'ROLE_CHANGE' },
    })

    expect(log).toBeTruthy()
    const logDetails = log!.details as Record<string, unknown>
    expect(logDetails.before).toEqual({ role: 'STUDENT' })
    expect(logDetails.after).toEqual({ role: 'SUPERVISOR' })
    expect(logDetails.reason).toBe('promotion')
    expect(log!.beforeJson).toEqual({ role: 'STUDENT' })
    expect(log!.afterJson).toEqual({ role: 'SUPERVISOR' })
    expect(log!.userEmail).toBe('audit2@test.com')
    expect(log!.userRole).toBe('ADMIN')
  })
})
