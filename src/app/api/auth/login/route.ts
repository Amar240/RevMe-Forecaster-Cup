import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, createSession } from '@/lib/auth'
import { jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const data = await parseJson(request, loginSchema)

    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (!user) {
      throw new ApiError('Invalid email or password', 401, 'UNAUTHORIZED')
    }

    if (!user.isActive) {
      throw new ApiError('Your account is inactive. Please contact an administrator.', 403, 'FORBIDDEN')
    }

    const validPassword = await verifyPassword(data.password, user.passwordHash)

    if (!validPassword) {
      throw new ApiError('Invalid email or password', 401, 'UNAUTHORIZED')
    }

    await createSession(user.id)

    return jsonOk({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    })
  } catch (error) {
    return jsonError(error, 'Login failed')
  }
}
