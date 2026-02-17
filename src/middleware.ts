import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

const CSRF_COOKIE = 'revme_csrf'
const CSRF_HEADER = 'x-csrf-token'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
])
const SENSITIVE_PATH_PREFIXES = [
  '/api/submissions',
  '/api/support-tickets',
  '/api/join-requests',
  '/api/teams',
  '/api/users',
  '/api/admin',
]

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method.toUpperCase()
  const isUnsafe = UNSAFE_METHODS.has(method)

  if (pathname.startsWith('/api')) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.nextUrl.origin
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
    const alternateHost =
      host.includes('localhost') ? host.replace('localhost', '127.0.0.1') : host.replace('127.0.0.1', 'localhost')
    const allowedOrigins = new Set([host, alternateHost, configuredOrigin].filter(Boolean) as string[])

    if (isUnsafe) {
      const source = origin || referer
      if (source && !Array.from(allowedOrigins).some((allowed) => source.startsWith(allowed))) {
        return NextResponse.json({ message: 'Invalid origin' }, { status: 403 })
      }
    }

    const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value
    if (isUnsafe) {
      const csrfHeader = request.headers.get(CSRF_HEADER)
      if (!csrfCookie || !csrfHeader || csrfHeader !== csrfCookie) {
        const response = NextResponse.json({ message: 'Invalid CSRF token' }, { status: 403 })
        if (!csrfCookie) {
          response.cookies.set(CSRF_COOKIE, crypto.randomUUID(), {
            httpOnly: false,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
          })
        }
        return response
      }
    }

    if (method === 'POST' && AUTH_PATHS.has(pathname)) {
      const key = `${request.ip ?? 'unknown'}:${pathname}`
      const allowed = rateLimit(key, 10, 60_000)
      if (!allowed) {
        return NextResponse.json({ message: 'Too many requests' }, { status: 429 })
      }
    } else if (isUnsafe && SENSITIVE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      const key = `${request.ip ?? 'unknown'}:${pathname}`
      const allowed = rateLimit(key, 60, 60_000)
      if (!allowed) {
        return NextResponse.json({ message: 'Too many requests' }, { status: 429 })
      }
    } else if (isUnsafe) {
      const key = `${request.ip ?? 'unknown'}:${pathname}`
      const allowed = rateLimit(key, 120, 60_000)
      if (!allowed) {
        return NextResponse.json({ message: 'Too many requests' }, { status: 429 })
      }
    }
  }

  const response = NextResponse.next()
  const csrfCookie = request.cookies.get(CSRF_COOKIE)?.value
  if (!csrfCookie) {
    response.cookies.set(CSRF_COOKIE, crypto.randomUUID(), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
  }
  response.headers.set('x-pathname', request.nextUrl.pathname)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
