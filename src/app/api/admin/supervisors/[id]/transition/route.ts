import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  ApiError,
  jsonError,
  jsonOk,
  parseJson,
  requireAdminOrResponse,
} from '@/server/http'
import {
  executeSupervisorTransition,
  getSupervisorTransitionPreflight,
} from '@/server/supervisor-transition'
import {
  executeSupervisorAffiliationCorrection,
  getSupervisorAffiliationCorrectionPreflight,
} from '@/server/supervisor-affiliation-correction'

export const dynamic = 'force-dynamic'

const operationSchema = z.enum(['CORRECT_AFFILIATION', 'CHANGE_UNIVERSITY', 'DEACTIVATE'])

const transitionSchema = z.object({
  operation: operationSchema,
  targetUniversityId: z.string().min(1).nullable().optional(),
  reason: z.string().trim().min(5).max(500),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  typedTargetUniversityName: z.string().trim().min(1).max(200).optional(),
  teamResolutions: z.array(z.object({
    teamId: z.string().min(1),
    action: z.enum(['REASSIGN', 'UNASSIGN']),
    supervisorId: z.string().min(1).nullable().optional(),
  })).max(100).default([]),
  joinRequestResolutions: z.array(z.object({
    joinRequestId: z.string().min(1),
    action: z.enum(['REASSIGN', 'CANCEL']),
    supervisorId: z.string().min(1).nullable().optional(),
  })).max(100).default([]),
  ticketResolutions: z.array(z.object({
    ticketId: z.string().min(1),
    action: z.enum(['REASSIGN', 'ESCALATE']),
    supervisorId: z.string().min(1).nullable().optional(),
  })).max(100).default([]),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user!.role !== 'ADMIN') {
      throw new ApiError('Only full administrators can manage supervisor transitions.', 403, 'FORBIDDEN')
    }

    const { id } = await params
    const operation = operationSchema.parse(request.nextUrl.searchParams.get('operation'))
    const targetUniversityId = request.nextUrl.searchParams.get('targetUniversityId')
    const data = operation === 'DEACTIVATE'
      ? await getSupervisorTransitionPreflight({ actor: user!, supervisorId: id, operation, targetUniversityId })
      : await getSupervisorAffiliationCorrectionPreflight({
          actor: user!,
          supervisorId: id,
          targetUniversityId: targetUniversityId ?? '',
        })
    return jsonOk(data)
  } catch (error) {
    return jsonError(error, 'Failed to prepare supervisor transition')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user!.role !== 'ADMIN') {
      throw new ApiError('Only full administrators can manage supervisor transitions.', 403, 'FORBIDDEN')
    }

    const { id } = await params
    const body = await parseJson(request, transitionSchema)
    const data = body.operation === 'DEACTIVATE'
      ? await executeSupervisorTransition({
          actor: user!,
          supervisorId: id,
          operation: body.operation,
          targetUniversityId: body.targetUniversityId,
          reason: body.reason,
          fingerprint: body.fingerprint,
          teamResolutions: body.teamResolutions ?? [],
          joinRequestResolutions: body.joinRequestResolutions ?? [],
          ticketResolutions: body.ticketResolutions ?? [],
        })
      : await executeSupervisorAffiliationCorrection({
          actor: user!,
          supervisorId: id,
          targetUniversityId: body.targetUniversityId ?? '',
          typedTargetUniversityName: body.typedTargetUniversityName ?? '',
          reason: body.reason,
          fingerprint: body.fingerprint,
        })
    return jsonOk(data)
  } catch (error) {
    return jsonError(error, 'Failed to complete supervisor transition')
  }
}
