import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { getAppBaseUrl } from '@/lib/app-url'

const CSRF_COOKIE = 'revme_csrf'
const CSRF_HEADER = 'x-csrf-token'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
])
const SENSITIVE_PATH_PREFIXES = [
  '/api/submissions',
  '/api/support-tickets',
  '/api/join-requests',
  '/api/teams',
  '/api/users',
  '/api/admin',
]

function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function addAllowedOriginVariants(allowedOrigins: Set<string>, origin: string | null) {
  if (!origin) {
    return
  }

  allowedOrigins.add(origin)

  try {
    const url = new URL(origin)

    if (url.hostname === 'localhost') {
      allowedOrigins.add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ''}`)
    } else if (url.hostname === '127.0.0.1') {
      allowedOrigins.add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ''}`)
    }

    if (url.hostname === 'rev-me.org') {
      allowedOrigins.add(`${url.protocol}//www.rev-me.org`)
    } else if (url.hostname === 'www.rev-me.org') {
      allowedOrigins.add(`${url.protocol}//rev-me.org`)
    }
  } catch {
    return
  }
}

function resolveRequestSourceOrigin(request: NextRequest) {
  const origin = normalizeOrigin(request.headers.get('origin'))
  if (origin) {
    return origin
  }

  return normalizeOrigin(request.headers.get('referer'))
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const method = request.method.toUpperCase()
  const isUnsafe = UNSAFE_METHODS.has(method)

  if (pathname.startsWith('/api')) {
    const host = normalizeOrigin(request.nextUrl.origin)
    const configuredOrigin = normalizeOrigin(getAppBaseUrl())
    const allowedOrigins = new Set<string>()
    addAllowedOriginVariants(allowedOrigins, host)
    addAllowedOriginVariants(allowedOrigins, configuredOrigin)

    if (isUnsafe) {
      const sourceOrigin = resolveRequestSourceOrigin(request)
      if (!sourceOrigin || !allowedOrigins.has(sourceOrigin)) {
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
