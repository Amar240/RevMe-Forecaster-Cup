import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from './db'
import { createUniversity } from './fixtures'
import { GET as startGoogle } from '@/app/api/auth/google/start/route'
import { GET as googleCallback } from '@/app/api/auth/google/callback/route'
import { POST as completeProfile } from '@/app/api/auth/google/complete-profile/route'
import { openOAuthValue, PKCE_COOKIE, setOAuthCookie, SIGNUP_COOKIE } from '@/server/oauth-cookies'
import { getAppBaseUrl } from '@/lib/app-url'

const originalId = process.env.GOOGLE_CLIENT_ID; const originalSecret = process.env.GOOGLE_CLIENT_SECRET
afterEach(() => { process.env.GOOGLE_CLIENT_ID = originalId; process.env.GOOGLE_CLIENT_SECRET = originalSecret })
describe('Google OAuth routes', () => {
  it('returns 404 when Google OAuth is disabled', async () => {
    delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET
    expect((await startGoogle(new NextRequest('http://localhost:5000/api/auth/google/start'))).status).toBe(404)
  })

  it('starts PKCE with an encrypted HTTP-only cookie and correct redirect', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'; process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    const response = await startGoogle(new NextRequest('http://localhost:5000/api/auth/google/start'))
    expect(response.status).toBe(302)
    const location = new URL(response.headers.get('location')!)
    expect(location.origin).toBe('https://accounts.google.com')
    expect(location.searchParams.get('client_id')).toBe('client-id')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    expect(location.searchParams.get('redirect_uri')).toBe(`${getAppBaseUrl()}/api/auth/google/callback`)
    expect(location.searchParams.has('code_verifier')).toBe(false)
    const cookie = global.__testCookieOps.find((item) => item.type === 'set' && item.name === PKCE_COOKIE)
    expect(cookie?.value).toBeTruthy()
    expect(cookie?.value).not.toContain(location.searchParams.get('state')!)
  })

  it('retains bounded parallel PKCE flows and rejects mismatched state before token exchange', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'; process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    await startGoogle(new NextRequest('http://localhost:5000/api/auth/google/start'))
    await startGoogle(new NextRequest('http://localhost:5000/api/auth/google/start'))
    const flows = openOAuthValue<Array<{ state: string }>>(global.__testCookies[PKCE_COOKIE], 'pkce')
    expect(flows).toHaveLength(2)
    const fetchSpy = vi.spyOn(global, 'fetch')
    const response = await googleCallback(new NextRequest('http://localhost:5000/api/auth/google/callback?state=wrong&code=unused'))
    expect(response.headers.get('location')).toContain('/login?error=oauth_state')
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('creates the only allowed passwordless user from verified pending state and consumes it', async () => {
    process.env.GOOGLE_CLIENT_ID = 'client-id'; process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    const university = await createUniversity('Google Signup University')
    await setOAuthCookie(SIGNUP_COOKIE, { sub: 'new-sub', email: 'new-google@oauth.test', emailVerified: true, givenName: 'New', familyName: 'Google', createdAt: Date.now() }, 'signup')
    const request = new NextRequest('http://localhost:5000/api/auth/google/complete-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'STUDENT', universitySelectionMode: 'EXISTING', universityId: university.id, universityConfirmed: true }) })
    const response = await completeProfile(request)
    expect(response.status).toBe(201)
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'new-google@oauth.test' }, include: { oauthAccounts: true } })
    expect(user).toMatchObject({ passwordHash: null, emailVerified: true, role: 'STUDENT' })
    expect(user.oauthAccounts).toHaveLength(1)
    expect(global.__testCookieOps.some((item) => item.type === 'delete' && item.name === SIGNUP_COOKIE)).toBe(true)
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1)
    const replay = new NextRequest('http://localhost:5000/api/auth/google/complete-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'STUDENT', universitySelectionMode: 'EXISTING', universityId: university.id, universityConfirmed: true }) })
    expect((await completeProfile(replay)).status).toBe(401)
  })
})
