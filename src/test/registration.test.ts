import bcrypt from 'bcryptjs'
import { describe, expect, it, vi } from 'vitest'
import { loginAs } from './auth'
import { createUniversity, createUser } from './fixtures'
import { makeRequest } from './http'
import { prisma } from './db'

const emailMocks = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: emailMocks.sendPasswordResetEmail,
  sendWelcomeEmail: emailMocks.sendWelcomeEmail,
}))

import { POST as forgotPasswordHandler } from '@/app/api/auth/forgot-password/route'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { POST as resetPasswordHandler } from '@/app/api/auth/reset-password/route'

const BASE = 'http://localhost:5000'

describe('Registration and auth flow', () => {
  it('registers a valid student and creates a session', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'student.register@test.com',
        password: 'Password123!',
        firstName: 'Student',
        lastName: 'Register',
        role: 'STUDENT',
        universityName: 'Registration University',
        country: 'United States',
      },
    })

    const res = await registerHandler(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.user.email).toBe('student.register@test.com')
    expect(data.user.role).toBe('STUDENT')
    expect(global.__testAuthToken).toBeTruthy()
    expect(global.__testCookieOps.some((entry) => entry.type === 'set')).toBe(true)

    const user = await prisma.user.findUnique({
      where: { email: 'student.register@test.com' },
    })
    expect(user).not.toBeNull()

    const session = await prisma.session.findUnique({
      where: { token: global.__testAuthToken! },
    })
    expect(session?.userId).toBe(user!.id)
    expect(emailMocks.sendWelcomeEmail).toHaveBeenCalledWith('student.register@test.com', 'Student', 'STUDENT')
  })

  it('returns 409 for duplicate email registration', async () => {
    const university = await createUniversity('Duplicate Registration University')
    await createUser({
      email: 'duplicate.register@test.com',
      role: 'STUDENT',
      universityId: university.id,
    })

    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'duplicate.register@test.com',
        password: 'Password123!',
        firstName: 'Duplicate',
        lastName: 'User',
        role: 'STUDENT',
        universityName: 'Duplicate Registration University',
        country: 'United States',
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(409)
  })

  it('returns 400 for invalid email format', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'not-an-email',
        password: 'Password123!',
        firstName: 'Invalid',
        lastName: 'Email',
        role: 'STUDENT',
        universityName: 'Validation University',
        country: 'United States',
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing required fields', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: { email: 'missing.fields@test.com' },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for too-short passwords', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'short.password@test.com',
        password: 'short',
        firstName: 'Short',
        lastName: 'Password',
        role: 'STUDENT',
        universityName: 'Validation University',
        country: 'United States',
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(400)
  })

  it('logs in with correct credentials and sets a session cookie', async () => {
    const university = await createUniversity('Login University')
    const user = await createUser({
      email: 'login.success@test.com',
      role: 'STUDENT',
      universityId: university.id,
      password: 'Password123!',
    })

    const req = makeRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      body: {
        email: 'login.success@test.com',
        password: 'Password123!',
      },
    })

    const res = await loginHandler(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user.id).toBe(user.id)
    expect(global.__testAuthToken).toBeTruthy()
    expect(global.__testCookieOps.some((entry) => entry.type === 'set')).toBe(true)

    const session = await prisma.session.findUnique({
      where: { token: global.__testAuthToken! },
    })
    expect(session?.userId).toBe(user.id)
  })

  it('returns 401 for wrong password', async () => {
    const university = await createUniversity('Wrong Password University')
    await createUser({
      email: 'wrong.password@test.com',
      role: 'STUDENT',
      universityId: university.id,
      password: 'Password123!',
    })

    const req = makeRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      body: {
        email: 'wrong.password@test.com',
        password: 'WrongPassword!',
      },
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 for non-existent email', async () => {
    const req = makeRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      body: {
        email: 'nobody@test.com',
        password: 'Password123!',
      },
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(401)
  })

  it('logs out and clears the session cookie and row', async () => {
    const university = await createUniversity('Logout University')
    const user = await createUser({
      email: 'logout.success@test.com',
      role: 'STUDENT',
      universityId: university.id,
    })
    const token = await loginAs(user.id)

    const beforeCount = await prisma.session.count({
      where: { token },
    })
    expect(beforeCount).toBe(1)

    const res = await logoutHandler()
    expect(res.status).toBe(200)
    expect(global.__testAuthToken).toBeNull()
    expect(global.__testCookieOps.some((entry) => entry.type === 'delete' && entry.name === 'revme_session')).toBe(true)

    const afterCount = await prisma.session.count({
      where: { token },
    })
    expect(afterCount).toBe(0)
  })

  it('returns the current user from /api/auth/me when logged in', async () => {
    const university = await createUniversity('Me University')
    const user = await createUser({
      email: 'me.success@test.com',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    await loginAs(user.id)

    const res = await meHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.user.id).toBe(user.id)
    expect(data.user.role).toBe('SUPERVISOR')
  })

  it('returns 401 from /api/auth/me when logged out', async () => {
    const res = await meHandler()
    expect(res.status).toBe(401)
  })

  it('creates a password reset token for a valid email', async () => {
    const university = await createUniversity('Forgot Password University')
    const user = await createUser({
      email: 'forgot.password@test.com',
      role: 'STUDENT',
      universityId: university.id,
    })

    const req = makeRequest(`${BASE}/api/auth/forgot-password`, {
      method: 'POST',
      body: { email: user.email },
    })

    const res = await forgotPasswordHandler(req)
    expect(res.status).toBe(200)

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    })
    expect(updatedUser?.resetToken).toBeTruthy()
    expect(updatedUser?.resetTokenExpiry).toBeTruthy()
    expect(emailMocks.sendPasswordResetEmail).toHaveBeenCalledWith(user.email, updatedUser!.resetToken)
  })

  it('resets the password with a valid token', async () => {
    const university = await createUniversity('Reset Password University')
    const user = await createUser({
      email: 'reset.success@test.com',
      role: 'STUDENT',
      universityId: university.id,
      password: 'Password123!',
    })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: 'valid-token',
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    const req = makeRequest(`${BASE}/api/auth/reset-password`, {
      method: 'POST',
      body: {
        token: 'valid-token',
        password: 'NewPassword456!',
      },
    })

    const res = await resetPasswordHandler(req)
    expect(res.status).toBe(200)

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    })
    expect(updatedUser?.resetToken).toBeNull()
    expect(updatedUser?.resetTokenExpiry).toBeNull()
    expect(await bcrypt.compare('NewPassword456!', updatedUser!.passwordHash)).toBe(true)
  })

  it('returns 400 for an expired reset token', async () => {
    const university = await createUniversity('Expired Token University')
    const user = await createUser({
      email: 'reset.expired@test.com',
      role: 'STUDENT',
      universityId: university.id,
    })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: 'expired-token',
        resetTokenExpiry: new Date(Date.now() - 60 * 1000),
      },
    })

    const req = makeRequest(`${BASE}/api/auth/reset-password`, {
      method: 'POST',
      body: {
        token: 'expired-token',
        password: 'NewPassword456!',
      },
    })

    const res = await resetPasswordHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid reset token', async () => {
    const req = makeRequest(`${BASE}/api/auth/reset-password`, {
      method: 'POST',
      body: {
        token: 'missing-token',
        password: 'NewPassword456!',
      },
    })

    const res = await resetPasswordHandler(req)
    expect(res.status).toBe(400)
  })
})
