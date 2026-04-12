import { describe, expect, it } from 'vitest'
import { prisma } from './db'
import { createUniversity, createUser } from './fixtures'
import { loginAs, logout } from './auth'

import { hashPassword, verifyPassword, getSession, destroySession, requireRole } from '@/lib/auth'

describe('hashPassword / verifyPassword', () => {
  it('hashes and verifies a password correctly', async () => {
    const hash = await hashPassword('TestPass123!')
    expect(hash).toBeTruthy()
    expect(hash).not.toBe('TestPass123!')

    const valid = await verifyPassword('TestPass123!', hash)
    expect(valid).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectPassword')
    const valid = await verifyPassword('WrongPassword', hash)
    expect(valid).toBe(false)
  })

  it('produces different hashes for the same input (salted)', async () => {
    const hash1 = await hashPassword('SamePassword')
    const hash2 = await hashPassword('SamePassword')
    expect(hash1).not.toBe(hash2)
  })
})

describe('getSession', () => {
  it('returns user for a valid session token', async () => {
    const uni = await createUniversity()
    const user = await createUser({ email: 'session@test.com', role: 'STUDENT', universityId: uni.id })
    await loginAs(user.id)

    const sessionUser = await getSession()
    expect(sessionUser).not.toBeNull()
    expect(sessionUser!.id).toBe(user.id)
    expect(sessionUser!.email).toBe('session@test.com')
  })

  it('returns null when no session cookie is set', async () => {
    logout()
    const sessionUser = await getSession()
    expect(sessionUser).toBeNull()
  })

  it('returns null for an expired session', async () => {
    const uni = await createUniversity()
    const user = await createUser({ email: 'expired@test.com', role: 'STUDENT', universityId: uni.id })

    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() - 1000),
      },
    })
    global.__testAuthToken = token

    const sessionUser = await getSession()
    expect(sessionUser).toBeNull()

    const deletedSession = await prisma.session.findUnique({ where: { token } })
    expect(deletedSession).toBeNull()
  })

  it('returns null for an inactive user and removes their sessions', async () => {
    const uni = await createUniversity()
    const user = await createUser({
      email: 'inactive-session@test.com',
      role: 'STUDENT',
      universityId: uni.id,
      isActive: false,
    })
    const token = await loginAs(user.id)

    const sessionUser = await getSession()
    expect(sessionUser).toBeNull()

    const deletedSession = await prisma.session.findUnique({ where: { token } })
    expect(deletedSession).toBeNull()
  })

  it('returns null for an unverified user and removes their sessions', async () => {
    const uni = await createUniversity()
    const user = await createUser({
      email: 'unverified-session@test.com',
      role: 'STUDENT',
      universityId: uni.id,
      emailVerified: false,
    })
    const token = await loginAs(user.id)

    const sessionUser = await getSession()
    expect(sessionUser).toBeNull()

    const deletedSession = await prisma.session.findUnique({ where: { token } })
    expect(deletedSession).toBeNull()
  })
})

describe('destroySession', () => {
  it('removes the session from the database', async () => {
    const uni = await createUniversity()
    const user = await createUser({ email: 'destroy@test.com', role: 'STUDENT', universityId: uni.id })
    const token = await loginAs(user.id)

    await destroySession()

    const session = await prisma.session.findFirst({ where: { token } })
    expect(session).toBeNull()
  })
})

describe('requireRole', () => {
  it('returns true when user has an allowed role', async () => {
    const admin = await createUser({ email: 'admin@test.com', role: 'ADMIN' })
    expect(requireRole(admin, ['ADMIN'])).toBe(true)
    expect(requireRole(admin, ['ADMIN', 'SUPERVISOR'])).toBe(true)
  })

  it('returns false when user role is not in allowed list', async () => {
    const uni = await createUniversity()
    const student = await createUser({ email: 'student@test.com', role: 'STUDENT', universityId: uni.id })
    expect(requireRole(student, ['ADMIN'])).toBe(false)
    expect(requireRole(student, ['SUPERVISOR'])).toBe(false)
  })

  it('returns false for null user', () => {
    expect(requireRole(null, ['ADMIN'])).toBe(false)
  })
})
