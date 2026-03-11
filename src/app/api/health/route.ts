import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function json(status: 'ok' | 'error', db: 'ok' | 'error', httpStatus: number) {
  return NextResponse.json(
    {
      status,
      checks: {
        app: 'ok',
        db,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: httpStatus,
      headers: {
        'cache-control': 'no-store',
      },
    }
  )
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return json('ok', 'ok', 200)
  } catch (error) {
    logger.error('Health check failed', {
      message: error instanceof Error ? error.message : String(error),
    })

    return json('error', 'error', 503)
  }
}
