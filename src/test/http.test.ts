import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { jsonOk, jsonError, parseJson, ApiError, requireUser, requireAdmin } from '@/lib/http'
import { ZodError, z } from 'zod'
import { createUser, createUniversity, grantPermission } from './fixtures'
import { loginAs, logout } from './auth'

describe('HTTP helpers', () => {
  describe('jsonOk', () => {
    it('returns correct status and body', async () => {
      const res = jsonOk({ data: 'hello' })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toBe('hello')
    })

    it('supports custom status', async () => {
      const res = jsonOk({ created: true }, 201)
      expect(res.status).toBe(201)
    })
  })

  describe('jsonError', () => {
    it('handles ApiError', async () => {
      const error = new ApiError('Not found', 404, 'NOT_FOUND')
      const res = jsonError(error)
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.message).toBe('Not found')
      expect(body.code).toBe('NOT_FOUND')
    })

    it('handles ZodError', async () => {
      const schema = z.object({ name: z.string() })
      let zodError: ZodError | undefined
      try {
        schema.parse({ name: 123 })
      } catch (e) {
        zodError = e as ZodError
      }

      const res = jsonError(zodError!)
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.message).toBe('Invalid input')
      expect(body.code).toBe('INVALID_INPUT')
    })

    it('handles string error', async () => {
      const res = jsonError('something broke')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.message).toBe('something broke')
    })

    it('handles unknown error with fallback message', async () => {
      const res = jsonError(new Error('crash'), 'Operation failed')
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.message).toBe('Operation failed')
    })
  })

  describe('parseJson', () => {
    const schema = z.object({ name: z.string().min(1) })

    it('parses valid body and schema', async () => {
      const req = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'Alice' }),
        headers: { 'content-type': 'application/json' },
      })

      const result = await parseJson(req, schema)
      expect(result.name).toBe('Alice')
    })

    it('throws ApiError for invalid JSON', async () => {
      const req = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        body: 'not json',
        headers: { 'content-type': 'application/json' },
      })

      await expect(parseJson(req, schema)).rejects.toThrow(ApiError)
    })

    it('throws ZodError for invalid shape', async () => {
      const req = new NextRequest('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
        headers: { 'content-type': 'application/json' },
      })

      await expect(parseJson(req, schema)).rejects.toThrow(ZodError)
    })
  })

  describe('requireUser', () => {
    it('returns user when authenticated', async () => {
      const uni = await createUniversity('Auth Uni')
      const user = await createUser({ email: 'auth@test.com', role: 'STUDENT', universityId: uni.id })
      await loginAs(user.id)

      const result = await requireUser()
      expect(result.id).toBe(user.id)
    })

    it('throws ApiError when not authenticated', async () => {
      logout()
      await expect(requireUser()).rejects.toThrow(ApiError)
    })
  })

  describe('requireAdmin', () => {
    it('returns user when admin', async () => {
      const uni = await createUniversity('Admin Uni')
      const admin = await createUser({ email: 'admin@test.com', role: 'ADMIN', universityId: uni.id })
      await loginAs(admin.id)

      const result = await requireAdmin()
      expect(result.id).toBe(admin.id)
    })

    it('throws ApiError when student', async () => {
      const uni = await createUniversity('Student Uni')
      const student = await createUser({ email: 'student@test.com', role: 'STUDENT', universityId: uni.id })
      await loginAs(student.id)

      await expect(requireAdmin()).rejects.toThrow(ApiError)
    })
  })
})
