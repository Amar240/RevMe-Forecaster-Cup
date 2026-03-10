import { describe, expect, it } from 'vitest'
import { createUser, createPermission, grantPermission } from './fixtures'
import { hasAdminAccess, canPerformAdminAction, checkPermission } from '@/lib/permissions'

describe('hasAdminAccess', () => {
  it('returns true for ADMIN role', async () => {
    const admin = await createUser({ email: 'admin@test.com', role: 'ADMIN' })
    expect(hasAdminAccess(admin)).toBe(true)
  })

  it('returns true for SUB_ADMIN with hasFullAccess', async () => {
    const subAdmin = await createUser({ email: 'full-sub@test.com', role: 'SUB_ADMIN', hasFullAccess: true })
    expect(hasAdminAccess(subAdmin)).toBe(true)
  })

  it('returns false for SUB_ADMIN without hasFullAccess', async () => {
    const subAdmin = await createUser({ email: 'limited-sub@test.com', role: 'SUB_ADMIN', hasFullAccess: false })
    expect(hasAdminAccess(subAdmin)).toBe(false)
  })

  it('returns false for STUDENT', async () => {
    const student = await createUser({ email: 'student@test.com', role: 'STUDENT' })
    expect(hasAdminAccess(student)).toBe(false)
  })

  it('returns false for SUPERVISOR', async () => {
    const supervisor = await createUser({ email: 'sup@test.com', role: 'SUPERVISOR' })
    expect(hasAdminAccess(supervisor)).toBe(false)
  })

  it('returns false for null', () => {
    expect(hasAdminAccess(null)).toBe(false)
  })
})

describe('canPerformAdminAction', () => {
  it('allows ADMIN without any permission check', async () => {
    const admin = await createUser({ email: 'admin2@test.com', role: 'ADMIN' })
    const result = await canPerformAdminAction(admin)
    expect(result).toBe(true)
  })

  it('allows ADMIN even when a specific permission is required', async () => {
    const admin = await createUser({ email: 'admin3@test.com', role: 'ADMIN' })
    const result = await canPerformAdminAction(admin, 'scoring:run')
    expect(result).toBe(true)
  })

  it('allows SUB_ADMIN with hasFullAccess', async () => {
    const subAdmin = await createUser({ email: 'full-sub2@test.com', role: 'SUB_ADMIN', hasFullAccess: true })
    const result = await canPerformAdminAction(subAdmin, 'scoring:run')
    expect(result).toBe(true)
  })

  it('allows SUB_ADMIN with the required permission granted', async () => {
    const admin = await createUser({ email: 'granter@test.com', role: 'ADMIN' })
    const subAdmin = await createUser({ email: 'perm-sub@test.com', role: 'SUB_ADMIN', hasFullAccess: false })
    await grantPermission(subAdmin.id, 'scoring:run', admin.id)

    const result = await canPerformAdminAction(subAdmin, 'scoring:run')
    expect(result).toBe(true)
  })

  it('blocks SUB_ADMIN without the required permission', async () => {
    const subAdmin = await createUser({ email: 'noperm-sub@test.com', role: 'SUB_ADMIN', hasFullAccess: false })

    const result = await canPerformAdminAction(subAdmin, 'scoring:run')
    expect(result).toBe(false)
  })

  it('blocks SUB_ADMIN when no permission is specified and hasFullAccess is false', async () => {
    const subAdmin = await createUser({ email: 'bare-sub@test.com', role: 'SUB_ADMIN', hasFullAccess: false })
    const result = await canPerformAdminAction(subAdmin)
    expect(result).toBe(false)
  })

  it('blocks STUDENT', async () => {
    const student = await createUser({ email: 'student2@test.com', role: 'STUDENT' })
    const result = await canPerformAdminAction(student, 'scoring:run')
    expect(result).toBe(false)
  })

  it('blocks null user', async () => {
    const result = await canPerformAdminAction(null, 'scoring:run')
    expect(result).toBe(false)
  })
})

describe('checkPermission', () => {
  it('returns true when user has the permission', async () => {
    const admin = await createUser({ email: 'admin4@test.com', role: 'ADMIN' })
    const subAdmin = await createUser({ email: 'check-sub@test.com', role: 'SUB_ADMIN', hasFullAccess: false })
    await grantPermission(subAdmin.id, 'users:manage', admin.id)

    const result = await checkPermission(subAdmin.id, 'users:manage')
    expect(result).toBe(true)
  })

  it('returns false when user does not have the permission', async () => {
    const subAdmin = await createUser({ email: 'nocheck-sub@test.com', role: 'SUB_ADMIN', hasFullAccess: false })

    const result = await checkPermission(subAdmin.id, 'users:manage')
    expect(result).toBe(false)
  })

  it('returns false for a permission that does not exist', async () => {
    const subAdmin = await createUser({ email: 'missing-perm@test.com', role: 'SUB_ADMIN', hasFullAccess: false })

    const result = await checkPermission(subAdmin.id, 'nonexistent:permission')
    expect(result).toBe(false)
  })
})
