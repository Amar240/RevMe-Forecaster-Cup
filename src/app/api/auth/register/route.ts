import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { sendWelcomeEmail } from '@/lib/email'
import { jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['STUDENT', 'SUPERVISOR']),
  universityName: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const data = await parseJson(request, registerSchema)

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (existingUser) {
      throw new ApiError('Email already registered', 409, 'CONFLICT')
    }

    let university = await prisma.university.findUnique({
      where: { name: data.universityName },
    })

    if (!university) {
      university = await prisma.university.create({
        data: { name: data.universityName },
      })
    }

    const passwordHash = await hashPassword(data.password)

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        universityId: university.id,
        emailVerified: true,
      },
    })

    await createSession(user.id)

    sendWelcomeEmail(user.email, user.firstName, user.role as 'STUDENT' | 'SUPERVISOR').catch(() => {})

    return jsonOk({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    })
  } catch (error) {
    return jsonError(error, 'Registration failed')
  }
}
