import { describe, expect, it } from 'vitest'
import { IMPORT_DIAGNOSTIC_CATALOG, diagnosticForLegacyMessage } from '@/lib/team-import/diagnostic-catalog'
import { IMPORT_DIAGNOSTIC_CODES } from '@/lib/team-import/diagnostics'
import { validateTeamImportUpload } from '@/lib/team-import/file-validation'
import { parseTeamImportFile } from '@/lib/team-import/parser'

describe('team import diagnostics', () => {
  it('has guidance for every stable diagnostic code', () => {
    expect(Object.keys(IMPORT_DIAGNOSTIC_CATALOG).sort()).toEqual([...IMPORT_DIAGNOSTIC_CODES].sort())
    for (const definition of Object.values(IMPORT_DIAGNOSTIC_CATALOG)) {
      expect(definition.title).toBeTruthy()
      expect(definition.explanation).toBeTruthy()
      expect(definition.resolution).toBeTruthy()
    }
  })

  it('preserves exact legacy strings while adding a stable person target', () => {
    const legacy = 'Row 11 · Additional Member 2: Student email is not valid'
    expect(diagnosticForLegacyMessage(legacy)).toMatchObject({ code: 'PERSON_EMAIL_MALFORMED', legacyMessage: legacy, provenance: 'Row 11 · Additional Member 2', target: { rowNumber: 11, columnLabel: 'Additional Member 2', field: 'email' } })
  })

  it('adds a stable editable team target', () => {
    expect(diagnosticForLegacyMessage('Team identifier is required')).toMatchObject({ code: 'TEAM_ID_REQUIRED', target: { columnLabel: 'Team', field: 'teamExternalId' }, editable: true })
  })

  it('returns sanitized source rows for manual mapping when layout detection fails', async () => {
    await expect(parseTeamImportFile({ fileName: 'odd.csv', fileBuffer: Buffer.from('Odd A,Odd B\nvalue,other') })).rejects.toMatchObject({ details: { assistEligibility: { layout: true }, mappingContext: { rows: [['Odd A', 'Odd B'], ['value', 'other']] } } })
  })
})

describe('team import file acceptance', () => {
  it('accepts UTF-8 CSV and rejects temporary, spoofed, binary, and UTF-16 files', () => {
    expect(() => validateTeamImportUpload('roster.csv', Buffer.from('TeamID,Email\nA,a@example.edu'))).not.toThrow()
    expect(() => validateTeamImportUpload('~$roster.xlsx', Buffer.from('PK\x03\x04'))).toThrow(/temporary Excel lock file/)
    expect(() => validateTeamImportUpload('roster.xlsx', Buffer.from('not a zip'))).toThrow(/not an Excel workbook/)
    expect(() => validateTeamImportUpload('roster.csv', Buffer.from([0, 1, 2]))).toThrow(/binary data/)
    expect(() => validateTeamImportUpload('roster.csv', Buffer.from([0xff, 0xfe, 0x41, 0]))).toThrow(/encoding/)
  })
})
