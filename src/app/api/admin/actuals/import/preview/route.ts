import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminOrResponse, jsonOk, jsonError, ApiError } from '@/server/http'
import { actualImportOverrideSchema, previewActualsImport } from '@/lib/actuals-import'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdminOrResponse('actuals:upload')
    if (response) return response
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new ApiError('Choose a CSV file to preview.', 422, 'INVALID_INPUT')
    const overrides = z.array(actualImportOverrideSchema).max(500).parse(JSON.parse(String(form.get('overrides') || '[]')))
    const { preview } = await previewActualsImport({ file, overrides })
    return jsonOk(preview)
  } catch (error) {
    return jsonError(error, 'Failed to preview actuals file')
  }
}
