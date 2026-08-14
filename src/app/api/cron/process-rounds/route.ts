import { NextRequest } from 'next/server'
import { z } from 'zod'

import { processRoundTransitions, reconcileSeasonRoundState } from '@/lib/round-scheduler'
import { assignMissedSubmissionWarnings } from '@/server/missed-submission-warnings'
import { processRoundAutomationOverrideReminder } from '@/server/round-automation-emergency'
import { ApiError, jsonError, jsonOk } from '@/server/http'
import { logger } from '@/server/logger'
import { processDeadlineReminders } from '@/server/round-reminders'

export const dynamic = 'force-dynamic'

const scheduledTransitionSchema = z.object({
  eventType: z.enum([
    'ROUND_BOUNDARY',
    'EMERGENCY_OVERRIDE_DUE',
    'EMERGENCY_OVERRIDE_ESCALATION',
  ]).default('ROUND_BOUNDARY'),
  seasonId: z.string().min(1).max(100),
  generation: z.number().int().positive().optional(),
  idempotencyKey: z.string().min(10).max(500).optional(),
  scheduledFor: z.string().datetime().optional(),
  overrideId: z.string().min(1).max(100).optional(),
})

function authorize(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error('CRON_SECRET is not configured; refusing to process round transitions')
    throw new ApiError('Cron service is not configured', 503, 'SERVICE_UNAVAILABLE')
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED')
  }
}

// Compatibility/recovery endpoint. It remains safe for an occasional external
// health cron, but exact round boundaries use the POST endpoint below.
export async function GET(request: NextRequest) {
  try {
    authorize(request)
    const result = await processRoundTransitions({ trigger: 'RECOVERY' })
    const reminders = await processDeadlineReminders()
    return jsonOk({ ok: true, ...result, reminders })
  } catch (error) {
    return jsonError(error, 'Failed to process round transitions')
  }
}

// EventBridge Scheduler invokes a small Lambda at each known boundary. The
// Lambda forwards this signed request; the database reconciler remains the
// authority and safely ignores stale/manual/idempotent events.
export async function POST(request: NextRequest) {
  try {
    authorize(request)
    const parsed = scheduledTransitionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw parsed.error

    if (parsed.data.eventType === 'EMERGENCY_OVERRIDE_DUE' || parsed.data.eventType === 'EMERGENCY_OVERRIDE_ESCALATION') {
      if (!parsed.data.overrideId) {
        throw new ApiError('Emergency override ID is required', 400, 'INVALID_INPUT')
      }
      const result = await processRoundAutomationOverrideReminder({
        seasonId: parsed.data.seasonId,
        overrideId: parsed.data.overrideId,
        eventType: parsed.data.eventType,
      })
      return jsonOk(result)
    }

    if (!parsed.data.generation || !parsed.data.idempotencyKey || !parsed.data.scheduledFor) {
      throw new ApiError('Scheduled round boundary payload is incomplete', 400, 'INVALID_INPUT')
    }

    const result = await reconcileSeasonRoundState({
      seasonId: parsed.data.seasonId,
      trigger: 'SCHEDULED',
      generation: parsed.data.generation,
      idempotencyKey: parsed.data.idempotencyKey,
      scheduledFor: new Date(parsed.data.scheduledFor),
    })

    // Assign missed-submission warnings + emails for any round this boundary just closed. Non-fatal.
    if (result.closedRoundIds.length > 0) {
      try {
        await assignMissedSubmissionWarnings({ roundIds: result.closedRoundIds, sendEmail: true, actorId: null })
      } catch (error) {
        logger.error('Missed-submission warning assignment failed after scheduled close', {
          closedRoundIds: result.closedRoundIds,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return jsonOk({ ok: true, ...result })
  } catch (error) {
    return jsonError(error, 'Failed to process scheduled round transition')
  }
}
