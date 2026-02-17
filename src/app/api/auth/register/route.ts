import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { sendWelcomeEmail } from '@/lib/email'
import { z } from 'zod'

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
    const body = await request.json()
    const data = registerSchema.parse(body)

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { message: 'Email already registered' },
        { status: 409 }
      )
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

    sendWelcomeEmail(user.email, user.firstName, user.role as 'STUDENT' | 'SUPERVISOR').catch(console.error)

    return NextResponse.json({
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Invalid input', errors: error.errors },
        { status: 400 }
      )
    }
    console.error('Registration error:', error)
    return NextResponse.json(
      { message: 'Registration failed' },
      { status: 500 }
    )
  }
}
