import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await parseJson(request, resetPasswordSchema)

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    })

    if (!user) {
      throw new ApiError('Invalid or expired reset token', 400, 'INVALID_INPUT')
    }

    const passwordHash = await hashPassword(password)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    })

    return jsonOk({ message: 'Password reset successful' })
  } catch (error) {
    return jsonError(error, 'Failed to reset password')
  }
}
