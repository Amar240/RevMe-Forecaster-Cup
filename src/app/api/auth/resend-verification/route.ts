import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendEmailVerificationEmail } from '@/lib/email'
import { issueEmailVerificationCode, normalizeVerificationEmail } from '@/server/email-verification'
import { ApiError, jsonError, jsonOk, parseJson } from '@/server/http'

export const dynamic = 'force-dynamic'

const resendSchema = z.object({
  email: z.string().trim().email(),
})

const GENERIC_RESEND_MESSAGE = 'If that email can be verified, a new verification code has been sent.'

export async function POST(request: NextRequest) {
  try {
    const data = await parseJson(request, resendSchema)
    const email = normalizeVerificationEmail(data.email)

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        emailVerified: true,
      },
    })

    if (!user || user.emailVerified) {
      return jsonOk({
        message: GENERIC_RESEND_MESSAGE,
      })
    }

    const { code } = await issueEmailVerificationCode(user.id)
    const emailSent = await sendEmailVerificationEmail(user.email, user.firstName, code)

    if (!emailSent) {
      throw new ApiError(
        'We could not send a new verification code right now. Please try again.',
        500,
        'INTERNAL_ERROR'
      )
    }

    return jsonOk({
      message: 'A new verification code has been sent.',
    })
  } catch (error) {
    return jsonError(error, 'Failed to resend verification code')
  }
}
