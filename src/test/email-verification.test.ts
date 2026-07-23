import { describe, expect, it, vi, beforeEach } from 'vitest'
import { makeRequest } from './http'
import { createUniversity, createUser } from './fixtures'
import { prisma } from './db'

const emailMocks = vi.hoisted(() => ({
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/email', () => ({
  sendEmailVerificationEmail: emailMocks.sendEmailVerificationEmail,
}))

import { issueEmailVerificationCode } from '@/server/email-verification'
import { POST as resendVerificationHandler } from '@/app/api/auth/resend-verification/route'
import { POST as verifyEmailHandler } from '@/app/api/auth/verify-email/route'

const BASE = 'http://localhost:5000'

describe('Email verification flow', () => {
  beforeEach(() => {
    emailMocks.sendEmailVerificationEmail.mockClear()
  })

  it('verifies a valid 6-digit code and marks the user verified', async () => {
    const university = await createUniversity('Verification University')
    const user = await createUser({
      email: 'verify.success@test.com',
      role: 'STUDENT',
      universityId: university.id,
      emailVerified: false,
    })
    const { code } = await issueEmailVerificationCode(user.id)

    const req = makeRequest(`${BASE}/api/auth/verify-email`, {
      method: 'POST',
      body: {
        email: user.email,
        code: ` ${code} `,
      },
    })

    const res = await verifyEmailHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.message).toBe('Your email has been verified.')

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    })
    expect(updatedUser?.emailVerified).toBe(true)
    expect(updatedUser?.emailVerifiedAt).not.toBeNull()

    const verification = await prisma.emailVerificationCode.findFirst({
      where: { userId: user.id },
    })
    expect(verification?.usedAt).not.toBeNull()
  })

  it('rejects malformed verification codes cleanly', async () => {
    const req = makeRequest(`${BASE}/api/auth/verify-email`, {
      method: 'POST',
      body: {
        email: 'verify.format@test.com',
        code: '12ab',
      },
    })

    const res = await verifyEmailHandler(req)
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.message).toBe('Enter the 6-digit verification code.')
  })

  it('rejects expired verification codes', async () => {
    const university = await createUniversity('Expired Verification University')
    const user = await createUser({
      email: 'verify.expired@test.com',
      role: 'STUDENT',
      universityId: university.id,
      emailVerified: false,
    })
    const { code, recordId } = await issueEmailVerificationCode(user.id)

    await prisma.emailVerificationCode.update({
      where: { id: recordId },
      data: {
        expiresAt: new Date(Date.now() - 60_000),
      },
    })

    const req = makeRequest(`${BASE}/api/auth/verify-email`, {
      method: 'POST',
      body: {
        email: user.email,
        code,
      },
    })

    const res = await verifyEmailHandler(req)
    expect(res.status).toBe(400)

    const data = await res.json()
    expect(data.message).toBe('That code is invalid or expired.')
  })

  it('resend issues a fresh code and invalidates the previous unused code', async () => {
    const university = await createUniversity('Resend Verification University')
    const user = await createUser({
      email: 'verify.resend@test.com',
      role: 'SUPERVISOR',
      universityId: university.id,
      emailVerified: false,
    })
    const firstCode = await issueEmailVerificationCode(user.id)

    const req = makeRequest(`${BASE}/api/auth/resend-verification`, {
      method: 'POST',
      body: {
        email: user.email,
      },
    })

    const res = await resendVerificationHandler(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.message).toBe('A new verification code has been sent.')
    expect(emailMocks.sendEmailVerificationEmail).toHaveBeenCalledWith(
      user.email,
      user.firstName,
      expect.stringMatching(/^\d{6}$/)
    )

    const codes = await prisma.emailVerificationCode.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    })

    expect(codes).toHaveLength(2)
    expect(codes[0].id).toBe(firstCode.recordId)
    expect(codes[0].usedAt).not.toBeNull()
    expect(codes[1].usedAt).toBeNull()
  })

  it('resend returns a generic success message for unknown or already verified emails', async () => {
    const unknownReq = makeRequest(`${BASE}/api/auth/resend-verification`, {
      method: 'POST',
      body: {
        email: 'nobody@test.com',
      },
    })

    const unknownRes = await resendVerificationHandler(unknownReq)
    expect(unknownRes.status).toBe(200)

    const unknownData = await unknownRes.json()
    expect(unknownData.message).toBe('If that email can be verified, a new verification code has been sent.')

    const university = await createUniversity('Verified Resend University')
    const verifiedUser = await createUser({
      email: 'verified.resend@test.com',
      role: 'STUDENT',
      universityId: university.id,
      emailVerified: true,
    })

    const verifiedReq = makeRequest(`${BASE}/api/auth/resend-verification`, {
      method: 'POST',
      body: {
        email: verifiedUser.email,
      },
    })

    const verifiedRes = await resendVerificationHandler(verifiedReq)
    expect(verifiedRes.status).toBe(200)

    const verifiedData = await verifiedRes.json()
    expect(verifiedData.message).toBe('If that email can be verified, a new verification code has been sent.')
    expect(emailMocks.sendEmailVerificationEmail).not.toHaveBeenCalled()
  })
})
