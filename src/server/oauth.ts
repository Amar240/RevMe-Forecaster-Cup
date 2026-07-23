import { Prisma } from '@prisma/client'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { logAuditAction } from '@/lib/audit'

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean; givenName: string; familyName: string }
export type ReconcileDecision = 'SIGN_IN' | 'LINK' | 'UNVERIFIED' | 'SIGNUP'
export function decideGoogleReconciliation(input: { linked: boolean; userExists: boolean; emailVerified: boolean }): ReconcileDecision { if (input.linked) return 'SIGN_IN'; if (!input.emailVerified) return 'UNVERIFIED'; return input.userExists ? 'LINK' : 'SIGNUP' }

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleIdentity> {
  jwks ??= createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
  const { payload } = await jwtVerify(idToken, jwks, { audience: clientId, issuer: ['https://accounts.google.com', 'accounts.google.com'] })
  if (!payload.sub || typeof payload.email !== 'string' || typeof payload.email_verified !== 'boolean') throw new Error('Google identity claims are incomplete')
  return { sub: payload.sub, email: payload.email.trim().toLowerCase(), emailVerified: payload.email_verified, givenName: typeof payload.given_name === 'string' ? payload.given_name : '', familyName: typeof payload.family_name === 'string' ? payload.family_name : '' }
}

export async function reconcileGoogleIdentity(identity: GoogleIdentity, actorId?: string) {
  const linked = await prisma.oAuthAccount.findUnique({ where: { provider_providerAccountId: { provider: 'GOOGLE', providerAccountId: identity.sub } }, include: { user: true } })
  const emailUser = linked ? null : await prisma.user.findUnique({ where: { email: identity.email } })
  const decision = decideGoogleReconciliation({ linked: Boolean(linked), userExists: Boolean(emailUser), emailVerified: identity.emailVerified })
  if (decision === 'UNVERIFIED') return { decision } as const
  if (decision === 'SIGNUP') return { decision, identity } as const
  const user = linked?.user ?? emailUser!
  if (!user.isActive) throw new ApiError('Your account is inactive. Please contact an administrator.', 403, 'FORBIDDEN')
  if (decision === 'LINK') {
    try {
      await prisma.$transaction([
        prisma.oAuthAccount.create({ data: { userId: user.id, provider: 'GOOGLE', providerAccountId: identity.sub, email: identity.email } }),
        ...(!user.emailVerified ? [prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, emailVerifiedAt: new Date() } })] : []),
      ])
    } catch (error) { if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error }
    await logAuditAction(actorId ?? user.id, 'OAUTH_ACCOUNT_LINKED', 'User', user.id, { provider: 'GOOGLE', email: identity.email })
  }
  return { decision, userId: user.id } as const
}

export async function disconnectGoogleAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, oauthAccounts: { where: { provider: 'GOOGLE' }, select: { id: true, email: true } } } })
  if (!user) throw new ApiError('User not found', 404, 'NOT_FOUND')
  if (!user.passwordHash) throw new ApiError('Set a password before disconnecting Google.', 409, 'CONFLICT')
  const account = user.oauthAccounts[0]
  if (!account) throw new ApiError('Google is not connected', 404, 'NOT_FOUND')
  await prisma.oAuthAccount.delete({ where: { id: account.id } })
  await logAuditAction(userId, 'OAUTH_ACCOUNT_DISCONNECTED', 'User', userId, { provider: 'GOOGLE', email: account.email })
}
