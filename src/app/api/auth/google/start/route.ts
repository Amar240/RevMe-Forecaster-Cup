import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getAppBaseUrl } from '@/lib/app-url'
import { rateLimit } from '@/lib/rate-limit'
import { getGoogleOAuthConfig } from '@/server/oauth-config'
import { OAUTH_TTL_MS, PKCE_COOKIE, readOAuthCookie, setOAuthCookie } from '@/server/oauth-cookies'

export const dynamic = 'force-dynamic'

type Flow = { state: string; codeVerifier: string; createdAt: number }
export async function GET(request: NextRequest) {
  const config = getGoogleOAuthConfig(); if (!config) return new NextResponse(null, { status: 404 })
  if (!rateLimit(`${request.ip ?? 'unknown'}:/api/auth/google/start`, 10, 60_000)) return new NextResponse(null, { status: 429 })
  const now = Date.now(); const state = randomBytes(32).toString('base64url'); const codeVerifier = randomBytes(64).toString('base64url'); const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  const existing = await readOAuthCookie<Flow[]>(PKCE_COOKIE, 'pkce') ?? []
  await setOAuthCookie(PKCE_COOKIE, [...existing.filter((flow) => now - flow.createdAt < OAUTH_TTL_MS), { state, codeVerifier, createdAt: now }].slice(-5), 'pkce')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth'); url.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: `${getAppBaseUrl()}/api/auth/google/callback`, scope: 'openid email profile', state, code_challenge: codeChallenge, code_challenge_method: 'S256', prompt: 'select_account' }).toString()
  return NextResponse.redirect(url, 302)
}
