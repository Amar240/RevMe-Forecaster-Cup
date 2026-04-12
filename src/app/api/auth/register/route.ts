import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { sendEmailVerificationEmail } from '@/lib/email'
import { jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { issueEmailVerificationCode, normalizeVerificationEmail } from '@/server/email-verification'
import { resolveOrReusePendingUniversity } from '@/server/universities'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  role: z.enum(['STUDENT', 'SUPERVISOR']),
  universitySelectionMode: z.enum(['EXISTING', 'OTHER']).default('EXISTING'),
  universityId: z.string().trim().min(1).optional(),
  universityName: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.universitySelectionMode === 'EXISTING' && !data.universityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['universityId'],
      message: 'University is required',
    })
  }

  if (data.universitySelectionMode === 'OTHER' && !data.universityName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['universityName'],
      message: 'University name is required',
    })
  }

  if (data.universitySelectionMode === 'OTHER' && !data.country) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['country'],
      message: 'Country is required',
    })
  }
})

export async function POST(request: NextRequest) {
  try {
    const data = await parseJson(request, registerSchema)
    const normalizedEmail = normalizeVerificationEmail(data.email)

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      throw new ApiError('Email already registered', 409, 'CONFLICT')
    }

    const university = data.universitySelectionMode === 'EXISTING'
      ? await prisma.university.findFirst({
          where: {
            id: data.universityId,
            isListed: true,
          },
          select: { id: true },
        })
      : await resolveOrReusePendingUniversity({
          name: data.universityName!,
          country: data.country!,
        })

    if (!university) {
      throw new ApiError('Please select a listed university.', 422, 'INVALID_INPUT')
    }

    const passwordHash = await hashPassword(data.password)

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        universityId: university.id,
        emailVerified: false,
        emailVerifiedAt: null,
      },
    })

    const { code } = await issueEmailVerificationCode(user.id)
    const emailSent = await sendEmailVerificationEmail(user.email, user.firstName, code)

    return jsonOk({
      message: emailSent
        ? 'Registration successful. Verify your email to continue.'
        : 'Registration successful. Request a new verification code to continue.',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      email: user.email,
      requiresEmailVerification: true,
      emailSent,
    }, 201)
  } catch (error) {
    return jsonError(error, 'Registration failed')
  }
}
