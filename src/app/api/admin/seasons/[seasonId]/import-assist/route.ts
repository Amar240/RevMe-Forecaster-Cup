import { NextRequest } from 'next/server'
import { z } from 'zod'
import { logAuditAction } from '@/lib/audit'
import { ApiError, jsonError, jsonOk, parseJson, requireUserOrResponse } from '@/server/http'
import { getSeasonImportAssistStatus, setSeasonImportAssistMode } from '@/server/import-assist-settings'

export const dynamic = 'force-dynamic'
const updateSchema = z.object({ mode: z.enum(['DISABLED', 'ON_DEMAND']) }).strict()

async function fullAdmin() {
  const { user, response } = await requireUserOrResponse()
  if (response) return { user: null, response }
  if (user!.role !== 'ADMIN') throw new ApiError('Full administrator access required', 403, 'FORBIDDEN')
  return { user: user!, response: null }
}

export async function GET(_request: NextRequest, { params }: { params: { seasonId: string } }) {
  try {
    const { response } = await fullAdmin()
    if (response) return response
    return jsonOk(await getSeasonImportAssistStatus(params.seasonId))
  } catch (error) { return jsonError(error, 'Failed to load import assistance settings') }
}

export async function PATCH(request: NextRequest, { params }: { params: { seasonId: string } }) {
  try {
    const { user, response } = await fullAdmin()
    if (response) return response
    const input = await parseJson(request, updateSchema)
    const previous = await getSeasonImportAssistStatus(params.seasonId)
    await setSeasonImportAssistMode(params.seasonId, input.mode)
    await logAuditAction(user!.id, 'IMPORT_ASSIST_MODE_CHANGED', 'Season', params.seasonId, { previousMode: previous.mode, newMode: input.mode, changedAt: new Date().toISOString() })
    return jsonOk(await getSeasonImportAssistStatus(params.seasonId))
  } catch (error) { return jsonError(error, 'Failed to update import assistance settings') }
}
