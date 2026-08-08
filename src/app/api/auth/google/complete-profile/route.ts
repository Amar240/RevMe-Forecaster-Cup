import { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { createSession } from '@/lib/auth'
import { ApiError, jsonError, jsonOk, parseJson } from '@/server/http'
import { registrationProfileSchema } from '@/server/registration-schema'
import { getGoogleOAuthConfig } from '@/server/oauth-config'
import { clearOAuthCookie, OAUTH_TTL_MS, readOAuthCookie, SIGNUP_COOKIE } from '@/server/oauth-cookies'
import { findSimilarListedUniversities, resolveOrReusePendingUniversity } from '@/server/universities'

type Pending = { sub: string; email: string; emailVerified: boolean; givenName: string; familyName: string; createdAt: number }
export async function POST(request: NextRequest) {
  try {
    if (!getGoogleOAuthConfig()) throw new ApiError('Not found', 404, 'NOT_FOUND')
    const pending = await readOAuthCookie<Pending>(SIGNUP_COOKIE, 'signup'); await clearOAuthCookie(SIGNUP_COOKIE)
    if (!pending || !pending.emailVerified || Date.now() - pending.createdAt >= OAUTH_TTL_MS) throw new ApiError('Google signup session is missing or expired', 401, 'UNAUTHORIZED')
    const data = await parseJson(request, registrationProfileSchema)
    if (data.universitySelectionMode === 'OTHER' && !data.confirmedNoMatchingUniversity) {
      const similarUniversities = await findSimilarListedUniversities(data.universityName!, data.country)
      if (similarUniversities.length > 0) {
        throw new ApiError('We found similar universities. Select the correct university or confirm that none match.', 409, 'CONFLICT', { similarUniversities })
      }
    }
    const university = data.universitySelectionMode === 'EXISTING' ? await prisma.university.findFirst({ where: { id: data.universityId, isListed: true }, select: { id: true } }) : await resolveOrReusePendingUniversity({ name: data.universityName!, country: data.country! })
    if (!university) throw new ApiError('Please select a listed university.', 422, 'INVALID_INPUT')
    let userId: string
    try {
      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({ data: { email: pending.email, passwordHash: null, firstName: pending.givenName || pending.email.split('@')[0], lastName: pending.familyName, role: data.role, universityId: university.id, emailVerified: true, emailVerifiedAt: new Date() } })
        await tx.oAuthAccount.create({ data: { userId: created.id, provider: 'GOOGLE', providerAccountId: pending.sub, email: pending.email } })
        return created
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      userId = user.id
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError('This Google account has already been registered', 409, 'CONFLICT'); throw error }
    await createSession(userId)
    return jsonOk({ message: 'Registration complete' }, 201)
  } catch (error) { return jsonError(error, 'Google registration failed') }
}
