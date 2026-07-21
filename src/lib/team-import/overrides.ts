import { z } from 'zod'
import { ApiError } from '@/server/http'
import type { ParsedTeamImportFile, TeamImportOverride, TeamImportPersonInput } from './types'

export const TEAM_IMPORT_EXAMPLE_MARKER = 'EXAMPLE — delete before submitting'
export const TEAM_IMPORT_PERSON_LABELS = ['Corresponding Team Member', 'Additional Member 1', 'Additional Member 2', 'Additional Member 3', 'Additional Member 4'] as const

export function cleanImportCell(value: string | null | undefined) {
  return (value ?? '').replace(/[\t\r\u00a0\u200b-\u200d\ufeff]/g, ' ').replace(/\s+/g, ' ').trim()
}

const overrideSchema = z.object({
  rowNumber: z.number().int().positive().max(10000),
  columnLabel: z.enum(['Team', ...TEAM_IMPORT_PERSON_LABELS]),
  field: z.enum(['teamName', 'teamExternalId', 'firstName', 'lastName', 'email']),
  original: z.string().max(320), value: z.string().max(320),
}).superRefine((item, ctx) => {
  const teamField = item.field === 'teamName' || item.field === 'teamExternalId'
  if ((item.columnLabel === 'Team') !== teamField) ctx.addIssue({ code: 'custom', message: 'Override field does not match its column label' })
})
export const teamImportOverridesSchema = z.array(overrideSchema).max(200)

export function parseTeamImportOverrides(value: string | null) {
  if (!value) return []
  let decoded: unknown
  try { decoded = JSON.parse(value) } catch { throw new ApiError('Overrides must be valid JSON', 400, 'INVALID_INPUT') }
  const result = teamImportOverridesSchema.safeParse(decoded)
  if (!result.success) throw new ApiError('Overrides are invalid', 400, 'INVALID_INPUT', result.error.flatten())
  return result.data.map((item) => ({ ...item, original: cleanImportCell(item.original), value: cleanImportCell(item.value) }))
}

function personFor(row: ParsedTeamImportFile['rows'][number], label: TeamImportOverride['columnLabel']): TeamImportPersonInput | null {
  if (label === 'Corresponding Team Member') return row.submitter
  if (label === 'Team') return null
  const index = Number(label.slice(-1)) - 1
  return row.members.find((person) => person.provenance?.endsWith(label)) ?? row.members[index] ?? null
}

export function applyTeamImportOverrides(parsed: ParsedTeamImportFile, overrides: TeamImportOverride[]) {
  for (const override of overrides) {
    const row = parsed.rows.find((candidate) => candidate.rowNumber === override.rowNumber)
    if (!row) throw new ApiError(`Override row ${override.rowNumber} was not found`, 409, 'CONFLICT')
    const target = override.columnLabel === 'Team' ? row : personFor(row, override.columnLabel)
    if (!target) throw new ApiError(`${override.columnLabel} was not found on row ${override.rowNumber}`, 409, 'CONFLICT')
    const current = cleanImportCell(String(target[override.field as keyof typeof target] ?? ''))
    if (current !== override.original) throw new ApiError(`Original value changed for row ${override.rowNumber} · ${override.columnLabel}`, 409, 'CONFLICT')
    ;(target as unknown as Record<string, string>)[override.field] = override.field === 'email' ? override.value.toLowerCase() : override.value
  }
  return parsed
}
