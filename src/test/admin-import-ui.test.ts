import { describe, expect, it } from 'vitest'
import { createImportDiagnostic } from '@/lib/team-import/diagnostic-catalog'
import type { TeamImportPreviewRow } from '@/lib/team-import/types'
import {
  filterAdminImportRows,
  getAdminImportRowStatus,
  groupImportDiagnostics,
} from '@/features/teams/admin-import-ui'

function previewRow(overrides: Partial<TeamImportPreviewRow> = {}): TeamImportPreviewRow {
  return {
    rowNumber: 9,
    format: 'legacy',
    teamExternalId: 'VIN-001',
    teamName: 'VinUniversity1',
    universityName: 'VinUniversity',
    supervisorEmail: null,
    supervisorLabel: null,
    submitterEmail: 'submitter@vinuni.edu.vn',
    submitter: {
      email: 'submitter@vinuni.edu.vn',
      firstName: 'Linh',
      lastName: 'Tran',
      displayName: 'Linh Tran',
      uploadedName: null,
      matchedName: null,
      nameMismatch: false,
      willBeCreated: true,
      provenance: 'Row 9 · Corresponding Team Member',
    },
    members: [],
    memberCount: 1,
    valid: false,
    autoMatchedSupervisor: false,
    warnings: [],
    warningCount: 0,
    errors: ['University could not be matched'],
    diagnostics: [
      createImportDiagnostic('UNIVERSITY_UNKNOWN', 'University could not be matched', 'ERROR'),
    ],
    ...overrides,
  }
}

describe('admin import review helpers', () => {
  it('classifies ready, warning, and invalid rows without relying on color', () => {
    expect(getAdminImportRowStatus(previewRow())).toBe('NEEDS_ATTENTION')
    expect(getAdminImportRowStatus(previewRow({ valid: true, warningCount: 1 }))).toBe('WARNINGS')
    expect(getAdminImportRowStatus(previewRow({ valid: true, warningCount: 0 }))).toBe('READY')
  })

  it('groups the same diagnostic across affected workbook rows', () => {
    const groups = groupImportDiagnostics([
      previewRow(),
      previewRow({ rowNumber: 10, teamName: 'VinUniversity2' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].diagnostic.code).toBe('UNIVERSITY_UNKNOWN')
    expect(groups[0].rowNumbers).toEqual([9, 10])
  })

  it('filters by status and searches team, member, and diagnostic text', () => {
    const ready = previewRow({
      rowNumber: 11,
      teamName: 'Forecast Forge',
      valid: true,
      errors: [],
      diagnostics: [],
    })
    const rows = [previewRow(), ready]

    expect(filterAdminImportRows(rows, 'READY', '')).toEqual([ready])
    expect(filterAdminImportRows(rows, 'ALL', 'vinuniversity1')).toHaveLength(1)
    expect(filterAdminImportRows(rows, 'ALL', 'submitter@vinuni.edu.vn')).toHaveLength(2)
  })
})
