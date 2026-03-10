import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { ZodSchema } from 'zod'
import { ZodError } from 'zod'
import { getSession } from '@/lib/auth'
import { canPerformAdminAction } from '@/lib/permissions'
import { logger } from '@/lib/logger'
import type { User } from '@prisma/client'

type ApiErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_INPUT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DUPLICATE'
  | 'INTERNAL_ERROR'
  | (string & {})

export class ApiError extends Error {
  status: number
  code: ApiErrorCode
  details?: unknown

  constructor(message: string, status: number, code: ApiErrorCode, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(error: unknown, fallbackMessage = 'Request failed') {
  if (typeof error === 'string') {
    return NextResponse.json(
      {
        message: error,
      },
      { status: 500 }
    )
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        message: error.message,
        code: error.code,
        details: error.details ?? null,
      },
      { status: error.status }
    )
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        message: 'Invalid input',
        code: 'INVALID_INPUT',
        details: error.flatten(),
      },
      { status: 400 }
    )
  }

  logger.error('Unhandled API error', {
    message: error instanceof Error ? error.message : String(error),
  })

  return NextResponse.json(
    {
      message: fallbackMessage,
    },
    { status: 500 }
  )
}

export async function parseJson<T>(request: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new ApiError('Invalid JSON', 400, 'INVALID_JSON')
  }
  return schema.parse(body)
}

export async function requireUser() {
  const user = await getSession()
  if (!user) {
    throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED')
  }
  return user
}

export async function requireAdmin(requiredPermission?: string) {
  const user = await requireUser()
  const canRun = await canPerformAdminAction(user, requiredPermission)
  if (!canRun) {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }
  return user
}

export async function requireUserOrResponse(
  message = 'Unauthorized',
  status = 401
): Promise<{ user: User | null; response: NextResponse | null }> {
  const user = await getSession()
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ message }, { status }),
    }
  }
  return { user, response: null }
}

export async function requireAdminOrResponse(
  requiredPermission?: string,
  message = 'Forbidden',
  status = 403
): Promise<{ user: User | null; response: NextResponse | null }> {
  const user = await getSession()
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    }
  }

  const canRun = await canPerformAdminAction(user, requiredPermission)
  if (!canRun) {
    return {
      user: null,
      response: NextResponse.json({ message }, { status }),
    }
  }

  return { user, response: null }
}
