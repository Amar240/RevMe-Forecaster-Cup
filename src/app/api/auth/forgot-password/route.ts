import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { sendPasswordResetEmail } from '@/lib/email'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (user) {
      const resetToken = randomBytes(32).toString('hex')
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      })

      await sendPasswordResetEmail(email, resetToken)
    }

    return NextResponse.json({
      message: 'If an account exists, reset instructions have been sent',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid email' }, { status: 400 })
    }
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { message: 'Failed to process request' },
      { status: 500 }
    )
  }
}
