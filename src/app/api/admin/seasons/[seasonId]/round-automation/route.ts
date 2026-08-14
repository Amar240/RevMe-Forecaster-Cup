import { NextRequest } from 'next/server'
import { z } from 'zod'

import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/lib/db'
import {
  buildRoundAutomationResumePreview,
  resumeAutomaticRoundScheduling,
  startOrExtendRoundAutomationEmergency,
} from '@/server/round-automation-emergency'
import { ApiError, jsonError, jsonOk, requireAdminOrResponse } from '@/server/http'
import { getRoundAutomationStatusPayload } from '@/server/round-automation-status'

export const dynamic = 'force-dynamic'

const updateModeSchema = z.object({
  mode: z.enum(['AUTOMATIC', 'MANUAL']),
  reason: z.string().trim().min(10).max(500),
  expectedEndAt: z.string().datetime().optional(),
  acknowledgeConsequences: z.boolean().optional(),
  fingerprint: z.string().length(64).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response
    const { seasonId } = await params
    return jsonOk(await getRoundAutomationStatusPayload(seasonId))
  } catch (error) {
    return jsonError(error, 'Failed to load round automation status')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user?.role !== 'ADMIN') {
      throw new ApiError('Only a full administrator can change round automation mode', 403, 'FORBIDDEN')
    }

    const { seasonId } = await params
    const parsed = updateModeSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) throw parsed.error

    if (parsed.data.mode === 'MANUAL') {
      if (!parsed.data.expectedEndAt || !parsed.data.acknowledgeConsequences) {
        throw new ApiError(
          'Emergency control requires a reason, expected review time, and confirmation.',
          400,
          'INVALID_INPUT'
        )
      }
      await startOrExtendRoundAutomationEmergency({
        seasonId,
        actor: { id: user.id, email: user.email, role: user.role },
        reason: parsed.data.reason,
        expectedEndAt: parsed.data.expectedEndAt,
        acknowledgeConsequences: parsed.data.acknowledgeConsequences,
      })
      return jsonOk(await getRoundAutomationStatusPayload(seasonId))
    }

    if (!parsed.data.fingerprint) {
      return jsonOk(
        {
          message: 'Review the resume preview before returning to automatic scheduling.',
          code: 'ROUND_AUTOMATION_RESUME_PREVIEW_REQUIRED',
          preview: await buildRoundAutomationResumePreview(seasonId),
        },
        409
      )
    }

    await resumeAutomaticRoundScheduling({
      seasonId,
      actor: { id: user.id, email: user.email, role: user.role },
      fingerprint: parsed.data.fingerprint,
      reason: parsed.data.reason,
    })

    await prisma.auditLog.create({
      data: buildAuditLogData(
        { id: user.id, email: user.email, role: user.role },
        'ROUND_AUTOMATION_SYNC_REQUESTED',
        'Season',
        seasonId,
        { details: { reason: parsed.data.reason } }
      ),
    })

    return jsonOk(await getRoundAutomationStatusPayload(seasonId))
  } catch (error) {
    return jsonError(error, 'Failed to change round automation mode')
  }
}
