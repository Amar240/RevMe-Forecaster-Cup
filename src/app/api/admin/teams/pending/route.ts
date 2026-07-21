import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, parseJson } from '@/server/http'
import { approveImportBatch, approvePendingTeam, getPendingApprovalGroups, rejectPendingTeam } from '@/server/team-approval'

export const dynamic = 'force-dynamic'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), teamId: z.string().min(1) }),
  z.object({ action: z.literal('reject'), teamId: z.string().min(1), reason: z.string().trim().min(1) }),
  z.object({ action: z.literal('approve-batch'), batchId: z.string().min(1) }),
])

export async function GET() {
  try {
    const { response } = await requireAdminOrResponse()
    if (response) return response
    return jsonOk(await getPendingApprovalGroups())
  } catch (error) { return jsonError(error, 'Failed to fetch pending teams') }
}

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    const body = await parseJson(request, actionSchema)
    if (body.action === 'approve') await approvePendingTeam(user!, body.teamId)
    else if (body.action === 'reject') await rejectPendingTeam(user!, body.teamId, body.reason)
    else await approveImportBatch(user!, body.batchId)
    return jsonOk({ message: body.action === 'approve-batch' ? 'Import batch approved' : body.action === 'approve' ? 'Team approved and activated' : 'Team rejected' })
  } catch (error) { return jsonError(error, 'Failed to process team approval') }
}
