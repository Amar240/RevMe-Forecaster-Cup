import crypto from 'crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'

type DbClient = PrismaClient | Prisma.TransactionClient

export const EMAIL_VERIFICATION_CODE_LENGTH = 6
export const EMAIL_VERIFICATION_TTL_MS = 15 * 60 * 1000

const VERIFICATION_CODE_PATTERN = new RegExp(`^\\d{${EMAIL_VERIFICATION_CODE_LENGTH}}$`)

export function normalizeVerificationEmail(email: string) {
  return email.trim().toLowerCase()
}

export function normalizeVerificationCodeInput(input: string) {
  return input.trim()
}

export function parseVerificationCodeInput(input: string) {
  const code = normalizeVerificationCodeInput(input)

  if (!code) {
    return {
      ok: false as const,
      reason: 'blank' as const,
    }
  }

  if (!VERIFICATION_CODE_PATTERN.test(code)) {
    return {
      ok: false as const,
      reason: 'format' as const,
    }
  }

  return {
    ok: true as const,
    code,
  }
}

export function hashVerificationCode(code: string) {
  return crypto.createHash('sha256').update(code).digest('hex')
}

function generateVerificationCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(EMAIL_VERIFICATION_CODE_LENGTH, '0')
}

export async function invalidateEmailVerificationCodes(
  userId: string,
  db: DbClient = prisma,
  excludeId?: string
) {
  await db.emailVerificationCode.updateMany({
    where: {
      userId,
      usedAt: null,
      ...(excludeId
        ? {
            id: {
              not: excludeId,
            },
          }
        : {}),
    },
    data: {
      usedAt: new Date(),
    },
  })
}

export async function issueEmailVerificationCode(
  userId: string,
  db: DbClient = prisma
) {
  const code = generateVerificationCode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS)

  await db.emailVerificationCode.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  })

  const record = await db.emailVerificationCode.create({
    data: {
      userId,
      codeHash: hashVerificationCode(code),
      expiresAt,
    },
  })

  return {
    code,
    expiresAt,
    recordId: record.id,
  }
}
