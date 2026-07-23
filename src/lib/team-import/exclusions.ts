import { z } from 'zod'
import { ApiError } from '@/server/http'

const excludedRowsSchema = z.array(z.number().int().positive()).max(100).refine(
  (rows) => new Set(rows).size === rows.length,
  'Excluded row numbers must be unique'
)

export function parseExcludedRowNumbers(value: string | null) {
  if (!value) return []
  try {
    return excludedRowsSchema.parse(JSON.parse(value)).sort((a, b) => a - b)
  } catch {
    throw new ApiError('Excluded row numbers are invalid', 400, 'INVALID_INPUT')
  }
}

