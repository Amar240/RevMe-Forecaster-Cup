import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { actualImportOverrideSchema, confirmActualsImport } from '@/lib/actuals-import'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdminOrResponse('actuals:upload')
    if (response) return response
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError('Choose a CSV file to import.', 422, 'INVALID_INPUT')
    const fileHash = z.string().regex(/^[a-f0-9]{64}$/).parse(String(form.get('fileHash') || ''))
    const overrides = z.array(actualImportOverrideSchema).max(500).parse(JSON.parse(String(form.get('overrides') || '[]')))
    const reason = z.string().trim().max(500).optional().parse(form.get('reason') ? String(form.get('reason')) : undefined)
    return jsonOk(await confirmActualsImport({ actorId: user!.id, file, fileHash, overrides, reason }))
  } catch (error) {
    return jsonError(error, 'Failed to import actuals')
  }
}
