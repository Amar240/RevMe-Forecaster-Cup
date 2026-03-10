import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'
import { jsonOk, jsonError, parseJson } from '@/server/http'
import { sendPasswordResetEmail } from '@/lib/email'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const { email } = await parseJson(request, forgotPasswordSchema)

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (user) {
      const resetToken = randomBytes(32).toString('hex')
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      })

      await sendPasswordResetEmail(email, resetToken)
    }

    return jsonOk({
      message: 'If an account exists, reset instructions have been sent',
    })
  } catch (error) {
    return jsonError(error, 'Failed to process request')
  }
}
