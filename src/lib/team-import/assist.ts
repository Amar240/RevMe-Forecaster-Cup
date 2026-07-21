import crypto from 'crypto'
import { z } from 'zod'
import { ApiError } from '@/server/http'
import type { ImportAssistSuggestion, TeamImportColumnMapping } from './types'

export const TEAM_IMPORT_CANONICAL_FIELDS = [
  'universityName', 'teamExternalId', 'teamName',
  'submitter.firstName', 'submitter.lastName', 'submitter.email',
  'member1.firstName', 'member1.lastName', 'member1.email',
  'member2.firstName', 'member2.lastName', 'member2.email',
  'member3.firstName', 'member3.lastName', 'member3.email',
  'member4.firstName', 'member4.lastName', 'member4.email',
] as const

export const columnMappingSchema = z.object({
  headerRowIndex: z.number().int().min(0).max(19),
  columnMap: z.array(z.object({ column: z.number().int().min(0).max(199), field: z.enum(TEAM_IMPORT_CANONICAL_FIELDS), confidence: z.number().min(0).max(1) })).min(6).max(18),
}).superRefine((value, ctx) => {
  if (new Set(value.columnMap.map((item) => item.column)).size !== value.columnMap.length) ctx.addIssue({ code: 'custom', message: 'Mapped columns must be unique' })
  if (new Set(value.columnMap.map((item) => item.field)).size !== value.columnMap.length) ctx.addIssue({ code: 'custom', message: 'Mapped fields must be unique' })
  for (const required of ['universityName', 'teamExternalId', 'submitter.firstName', 'submitter.lastName', 'submitter.email']) if (!value.columnMap.some((item) => item.field === required)) ctx.addIssue({ code: 'custom', message: `Mapping is missing ${required}` })
})

export const repairOutputSchema = z.object({ repairs: z.array(z.object({
  rowNumber: z.number().int().positive(),
  columnLabel: z.enum(['Corresponding Team Member', 'Additional Member 1', 'Additional Member 2', 'Additional Member 3', 'Additional Member 4']),
  field: z.enum(['firstName', 'lastName', 'email']),
  suggestion: z.string().trim().min(1).max(320),
  reason: z.string().trim().min(1).max(240),
  confidence: z.number().min(0).max(1),
})).max(100) })

export const assistOutcomeSchema = z.object({ batchId: z.string().min(1).max(64), suggestionId: z.string().length(64), outcome: z.enum(['ACCEPTED', 'REJECTED']) })

export function parseColumnMapping(value: string | null): TeamImportColumnMapping | null {
  if (!value) return null
  let decoded: unknown
  try { decoded = JSON.parse(value) } catch { throw new ApiError('Column mapping must be valid JSON', 400, 'INVALID_INPUT') }
  const result = columnMappingSchema.safeParse(decoded)
  if (!result.success) throw new ApiError('Column mapping is invalid', 400, 'INVALID_INPUT', result.error.flatten())
  return result.data
}

export function suggestionId(value: Omit<ImportAssistSuggestion, 'id' | 'outcome'>) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}
