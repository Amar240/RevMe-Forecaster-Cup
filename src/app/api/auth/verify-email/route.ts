import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ApiError, jsonError, jsonOk, parseJson } from '@/server/http'
import {
  hashVerificationCode,
  normalizeVerificationEmail,
  parseVerificationCodeInput,
} from '@/server/email-verification'

export const dynamic = 'force-dynamic'

const verifyEmailSchema = z.object({
  email: z.string().trim().email(),
  code: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const data = await parseJson(request, verifyEmailSchema)
    const email = normalizeVerificationEmail(data.email)
    const parsedCode = parseVerificationCodeInput(data.code)

    if (!parsedCode.ok) {
      throw new ApiError(
        parsedCode.reason === 'blank'
          ? 'Enter the verification code.'
          : 'Enter the 6-digit verification code.',
        400,
        'INVALID_INPUT'
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!user) {
      throw new ApiError('That code is invalid or expired.', 400, 'INVALID_INPUT')
    }

    const now = new Date()
    const verification = await prisma.emailVerificationCode.findFirst({
      where: {
        userId: user.id,
        codeHash: hashVerificationCode(parsedCode.code),
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: { id: true },
    })

    if (!verification) {
      throw new ApiError('That code is invalid or expired.', 400, 'INVALID_INPUT')
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifiedAt: now,
        },
      }),
      prisma.emailVerificationCode.update({
        where: { id: verification.id },
        data: {
          usedAt: now,
        },
      }),
      prisma.emailVerificationCode.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          id: {
            not: verification.id,
          },
        },
        data: {
          usedAt: now,
        },
      }),
    ])

    return jsonOk({
      message: 'Your email has been verified.',
    })
  } catch (error) {
    return jsonError(error, 'Email verification failed')
  }
}
