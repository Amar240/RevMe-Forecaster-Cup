import { NextRequest, NextResponse } from 'next/server'
import { processRoundTransitions } from '@/lib/round-scheduler'
import { logger } from '@/server/logger'
import { processDeadlineReminders } from '@/server/round-reminders'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    logger.error('CRON_SECRET is not configured; refusing to process round transitions')
    return NextResponse.json({ error: 'Cron service is not configured' }, { status: 503 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processRoundTransitions()
  const reminders = await processDeadlineReminders()
  return NextResponse.json({ ok: true, ...result, reminders })
}
