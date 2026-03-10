import { describe, expect, it } from 'vitest'
import { makeRequest } from './http'
import { loginAs } from './auth'
import { createUniversity, createUser } from './fixtures'

import { POST as loginHandler } from '@/app/api/auth/login/route'
import { POST as registerHandler } from '@/app/api/auth/register/route'
import { GET as meHandler } from '@/app/api/auth/me/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'

const BASE = 'http://localhost:5000'

describe('POST /api/auth/login', () => {
  it('returns 200 and user data on valid credentials', async () => {
    const uni = await createUniversity()
    await createUser({ email: 'login@test.com', role: 'STUDENT', universityId: uni.id, password: 'Password123!' })

    const req = makeRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      body: { email: 'login@test.com', password: 'Password123!' },
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.message).toBe('Login successful')
    expect(data.user.email).toBe('login@test.com')
    expect(data.user.role).toBe('STUDENT')
  })

  it('returns 401 for non-existent email', async () => {
    const req = makeRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      body: { email: 'nobody@test.com', password: 'anything' },
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(401)

    const data = await res.json()
    expect(data.code).toBe('UNAUTHORIZED')
  })

  it('returns 401 for wrong password', async () => {
    const uni = await createUniversity()
    await createUser({ email: 'wrong@test.com', role: 'STUDENT', universityId: uni.id, password: 'RightPassword' })

    const req = makeRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      body: { email: 'wrong@test.com', password: 'WrongPassword' },
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body (missing fields)', async () => {
    const req = makeRequest(`${BASE}/api/auth/login`, {
      method: 'POST',
      body: { email: 'not-an-email' },
    })

    const res = await loginHandler(req)
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.code).toBe('INVALID_INPUT')
  })
})

describe('POST /api/auth/register', () => {
  it('creates a new user and returns 200', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'newuser@test.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        role: 'STUDENT',
        universityName: 'Test University',
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.message).toBe('Registration successful')
    expect(data.user.email).toBe('newuser@test.com')
    expect(data.user.role).toBe('STUDENT')
  })

  it('returns 409 for duplicate email', async () => {
    const uni = await createUniversity()
    await createUser({ email: 'dup@test.com', role: 'STUDENT', universityId: uni.id })

    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'dup@test.com',
        password: 'Password123!',
        firstName: 'Dup',
        lastName: 'User',
        role: 'STUDENT',
        universityName: 'Test University',
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(409)

    const data = await res.json()
    expect(data.code).toBe('CONFLICT')
  })

  it('returns 400 for short password', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'short@test.com',
        password: 'abc',
        firstName: 'Short',
        lastName: 'Pass',
        role: 'STUDENT',
        universityName: 'Test University',
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.code).toBe('INVALID_INPUT')
  })

  it('returns 400 for missing required fields', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: { email: 'partial@test.com' },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  it('returns user data when authenticated', async () => {
    const uni = await createUniversity()
    const user = await createUser({ email: 'me@test.com', role: 'SUPERVISOR', universityId: uni.id })
    await loginAs(user.id)

    const res = await meHandler()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.user.id).toBe(user.id)
    expect(data.user.role).toBe('SUPERVISOR')
  })

  it('returns 401 when not authenticated', async () => {
    const res = await meHandler()
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('returns 200 on successful logout', async () => {
    const uni = await createUniversity()
    const user = await createUser({ email: 'logout@test.com', role: 'STUDENT', universityId: uni.id })
    await loginAs(user.id)

    const res = await logoutHandler()
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.message).toBe('Logged out successfully')
  })
})
