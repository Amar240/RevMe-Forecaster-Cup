import { describe, expect, it } from 'vitest'
import { prisma } from './db'
import { createUniversity, createUser } from './fixtures'
import { decideGoogleReconciliation, disconnectGoogleAccount, reconcileGoogleIdentity } from '@/server/oauth'
import { openOAuthValue, sealOAuthValue } from '@/server/oauth-cookies'

describe('Google OAuth security primitives', () => {
  it('encrypts cookie values and rejects tampering', () => {
    process.env.GOOGLE_CLIENT_SECRET = 'cookie-test-secret'
    const sealed = sealOAuthValue({ email: 'private@example.com' }, 'signup')
    expect(sealed).not.toContain('private@example.com')
    expect(openOAuthValue<{ email: string }>(sealed, 'signup')?.email).toBe('private@example.com')
    const tampered = `${sealed.slice(0, -1)}${sealed.endsWith('a') ? 'b' : 'a'}`
    expect(openOAuthValue(tampered, 'signup')).toBeNull()
  })

  it('covers all reconciliation decisions', () => {
    expect(decideGoogleReconciliation({ linked: true, userExists: true, emailVerified: true })).toBe('SIGN_IN')
    expect(decideGoogleReconciliation({ linked: false, userExists: true, emailVerified: true })).toBe('LINK')
    expect(decideGoogleReconciliation({ linked: false, userExists: true, emailVerified: false })).toBe('UNVERIFIED')
    expect(decideGoogleReconciliation({ linked: false, userExists: false, emailVerified: true })).toBe('SIGNUP')
  })

  it('links a verified email without overwriting account fields and later uses stable sub', async () => {
    const university = await createUniversity('OAuth University')
    const user = await createUser({ email: 'linked@oauth.test', role: 'SUPERVISOR', firstName: 'Original', universityId: university.id, password: 'LocalPassword!' })
    const linked = await reconcileGoogleIdentity({ sub: 'google-sub', email: user.email, emailVerified: true, givenName: 'Google', familyName: 'Changed' })
    expect(linked).toMatchObject({ decision: 'LINK', userId: user.id })
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(unchanged).toMatchObject({ firstName: 'Original', role: 'SUPERVISOR', passwordHash: user.passwordHash })
    const again = await reconcileGoogleIdentity({ sub: 'google-sub', email: 'changed@google.test', emailVerified: true, givenName: '', familyName: '' })
    expect(again).toMatchObject({ decision: 'SIGN_IN', userId: user.id })
  })

  it('never links an unverified email', async () => {
    const university = await createUniversity('Unverified OAuth University')
    await createUser({ email: 'unverified@oauth.test', role: 'STUDENT', universityId: university.id })
    expect(await reconcileGoogleIdentity({ sub: 'bad-sub', email: 'unverified@oauth.test', emailVerified: false, givenName: '', familyName: '' })).toEqual({ decision: 'UNVERIFIED' })
    expect(await prisma.oAuthAccount.count()).toBe(0)
  })

  it('blocks disconnect for a passwordless user and allows a password user', async () => {
    const university = await createUniversity('Disconnect University')
    const passwordUser = await createUser({ email: 'password@oauth.test', role: 'STUDENT', universityId: university.id })
    const passwordless = await prisma.user.create({ data: { email: 'only-google@oauth.test', passwordHash: null, firstName: 'Only', lastName: 'Google', role: 'STUDENT', universityId: university.id, emailVerified: true } })
    await prisma.oAuthAccount.createMany({ data: [{ userId: passwordUser.id, provider: 'GOOGLE', providerAccountId: 'one', email: passwordUser.email }, { userId: passwordless.id, provider: 'GOOGLE', providerAccountId: 'two', email: passwordless.email }] })
    await expect(disconnectGoogleAccount(passwordless.id)).rejects.toMatchObject({ status: 409 })
    await disconnectGoogleAccount(passwordUser.id)
    expect(await prisma.oAuthAccount.findFirst({ where: { userId: passwordUser.id } })).toBeNull()
  })
})
