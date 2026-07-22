import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/auth'
import { getAppBaseUrl } from '@/lib/app-url'
import { logger } from '@/lib/logger'
import { getGoogleOAuthConfig } from '@/server/oauth-config'
import { clearOAuthCookie, OAUTH_TTL_MS, PKCE_COOKIE, readOAuthCookie, setOAuthCookie, SIGNUP_COOKIE } from '@/server/oauth-cookies'
import { reconcileGoogleIdentity, verifyGoogleIdToken } from '@/server/oauth'

export const dynamic = 'force-dynamic'

type Flow = { state: string; codeVerifier: string; createdAt: number }
const redirect = (path: string) => NextResponse.redirect(new URL(path, getAppBaseUrl()), 302)
export async function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig(); if (!config) return new NextResponse(null, { status: 404 })
  const flows = await readOAuthCookie<Flow[]>(PKCE_COOKIE, 'pkce') ?? []; await clearOAuthCookie(PKCE_COOKIE)
  const state = request.nextUrl.searchParams.get('state'); const now = Date.now(); const flow = flows.find((item) => item.state === state && now - item.createdAt < OAUTH_TTL_MS)
  const remaining = flows.filter((item) => item !== flow && now - item.createdAt < OAUTH_TTL_MS); if (remaining.length) await setOAuthCookie(PKCE_COOKIE, remaining, 'pkce')
  if (!flow) return redirect('/login?error=oauth_state')
  try {
    const code = request.nextUrl.searchParams.get('code'); if (!code) throw new Error('Authorization code missing')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: `${getAppBaseUrl()}/api/auth/google/callback`, grant_type: 'authorization_code', code_verifier: flow.codeVerifier }) })
    if (!tokenResponse.ok) throw new Error(`Token exchange failed (${tokenResponse.status})`)
    const token = await tokenResponse.json() as { id_token?: string }; if (!token.id_token) throw new Error('ID token missing')
    const identity = await verifyGoogleIdToken(token.id_token, config.clientId); const result = await reconcileGoogleIdentity(identity)
    if (result.decision === 'UNVERIFIED') return redirect('/login?error=oauth_unverified_email')
    if (result.decision === 'SIGNUP') { await setOAuthCookie(SIGNUP_COOKIE, { ...identity, createdAt: now }, 'signup'); return redirect('/register/complete-profile') }
    await createSession(result.userId); return redirect('/dashboard')
  } catch (error) { logger.warn('Google OAuth callback failed', { error: error instanceof Error ? error.message : 'Unknown OAuth error' }); return redirect('/login?error=oauth_verify') }
}
