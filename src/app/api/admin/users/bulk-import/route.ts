import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson, ApiError } from '@/server/http'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAuditAction } from '@/lib/audit'
import { formatUniversityDisplayName, resolveOrCreateUniversity } from '@/server/universities'

export const dynamic = 'force-dynamic'

const rowSchema = z.object({
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  role: z.enum(['STUDENT', 'SUPERVISOR']),
  universityName: z.string().trim().min(1),
  password: z.string().min(8).optional().default('RevMe@2025!'),
})

const bulkImportSchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
  skipExisting: z.boolean().optional().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const body = await parseJson(request, bulkImportSchema)

    const results: {
      email: string
      status: 'created' | 'skipped' | 'error'
      reason?: string
    }[] = []

    for (const row of body.rows) {
      try {
        const email = row.email.toLowerCase()

        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing) {
          if (body.skipExisting) {
            results.push({ email, status: 'skipped', reason: 'Email already registered' })
            continue
          }
          throw new ApiError('Email already registered', 409, 'CONFLICT')
        }

        const university = await resolveOrCreateUniversity({
          name: formatUniversityDisplayName(row.universityName),
        })

        const hashedPassword = await hashPassword(row.password!)

        await prisma.user.create({
          data: {
            email,
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            role: row.role,
            passwordHash: hashedPassword,
            universityId: university.id,
          },
        })

        results.push({ email, status: 'created' })
      } catch (err) {
        results.push({
          email: row.email,
          status: 'error',
          reason: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const created = results.filter((r) => r.status === 'created').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const errors = results.filter((r) => r.status === 'error').length

    await logAuditAction(
      user!.id,
      'BULK_IMPORT_USERS',
      'User',
      'bulk',
      { total: body.rows.length, created, skipped, errors },
      null
    )

    return jsonOk({ results, summary: { total: body.rows.length, created, skipped, errors } })
  } catch (error) {
    return jsonError(error, 'Bulk import failed')
  }
}
