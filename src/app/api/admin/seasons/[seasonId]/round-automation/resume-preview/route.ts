import { NextRequest } from 'next/server'

import { ApiError, jsonError, jsonOk, requireAdminOrResponse } from '@/server/http'
import { buildRoundAutomationResumePreview } from '@/server/round-automation-emergency'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seasonId: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response
    if (user?.role !== 'ADMIN') {
      throw new ApiError('Only a full administrator can review emergency round control.', 403, 'FORBIDDEN')
    }

    const { seasonId } = await params
    return jsonOk({ preview: await buildRoundAutomationResumePreview(seasonId) })
  } catch (error) {
    return jsonError(error, 'Failed to build round scheduling resume preview')
  }
}
