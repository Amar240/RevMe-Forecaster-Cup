import { readFile } from 'fs/promises'
import { describe, expect, it } from 'vitest'
import { parseTeamImportFile } from '@/lib/team-import/parser'
import { applyTeamImportOverrides, cleanImportCell, parseTeamImportOverrides } from '@/lib/team-import/overrides'
import { buildRosterTemplate } from '@/lib/team-import/template'

describe('VinUniversity roster workbook parser', () => {
  it('parses metadata, all six teams, hygiene, provenance, and glued-name warnings', async () => {
    const fileBuffer = await readFile('src/test/fixtures/registration-vinuni-sample.xlsx')
    const parsed = await parseTeamImportFile({ fileName: 'registration-vinuni-sample.xlsx', fileBuffer })

    expect(parsed.detectedFormats).toEqual(['legacy'])
    expect(parsed.metadata).toEqual({
      universityName: 'VinUniversity',
      instructorName: 'Eric Olson',
      instructorEmail: 'eolson23@msudenver.edu',
      declaredTeamCount: 6,
    })
    expect(parsed.warnings).toEqual([])
    expect(parsed.rows).toHaveLength(6)
    expect(parsed.ignoredEmptyRows).toBeGreaterThan(0)
    expect(parsed.rows.map((row) => row.teamExternalId)).toEqual(['VinUniversity1', 'VinUniversity2', 'VinUniversity3', 'VinUniversity4', 'VinUniversity5', 'VinUniversity6'])

    const third = parsed.rows[2]
    expect(third.submitter).toMatchObject({ email: '23thuan.tc@vinuni.edu.vn', firstName: 'Canh Thuan', lastName: 'Thai', provenance: 'Row 11 · Corresponding Team Member' })
    expect(third.members[0].provenance).toBe('Row 11 · Additional Member 1')
    expect(third.members.some((member) => member.warnings?.some((warning) => warning.includes('possible glued name')))).toBe(true)

    for (const row of parsed.rows) {
      for (const person of [row.submitter, ...row.members]) {
        expect(person.email).toBe(person.email.trim().toLowerCase())
        expect(person.email).not.toMatch(/[\t\r\u00a0\u200b-\u200d\ufeff]/)
        expect(person.provenance).toMatch(new RegExp(`^Row ${row.rowNumber} · `))
      }
    }
  })

  it('selects Registration Form from the guided two-sheet template and excludes its example row', async () => {
    const fileBuffer = buildRosterTemplate({ universityName: 'University of Delaware', instructorName: 'Mara M', instructorEmail: 'mara@udel.edu' })
    const parsed = await parseTeamImportFile({ fileName: 'roster-template.xlsx', fileBuffer })

    expect(parsed.metadata).toMatchObject({
      universityName: 'University of Delaware',
      instructorName: 'Mara M',
      instructorEmail: 'mara@udel.edu',
    })
    expect(parsed.rows).toHaveLength(10)
    expect(parsed.rows[0]).toMatchObject({ rowNumber: 10, teamExternalId: 'University of Delaware1' })
    expect(parsed.rows.some((row) => row.teamExternalId.includes('EXAMPLE'))).toBe(false)
    expect(parsed.ignoredEmptyRows).toBeGreaterThan(0)
  })

  it('normalizes and applies overrides while rejecting changed originals', async () => {
    const fileBuffer = await readFile('src/test/fixtures/registration-vinuni-sample.xlsx')
    const parsed = await parseTeamImportFile({ fileName: 'registration-vinuni-sample.xlsx', fileBuffer })
    const overrides = parseTeamImportOverrides(JSON.stringify([{
      rowNumber: 9,
      columnLabel: 'Corresponding Team Member',
      field: 'email',
      original: parsed.rows[0].submitter.email,
      value: '  FIXED@VINUNI.EDU.VN\t',
    }]))

    expect(cleanImportCell(' A\t\u00a0 B ')).toBe('A B')
    expect(applyTeamImportOverrides(parsed, overrides).rows[0].submitter.email).toBe('fixed@vinuni.edu.vn')

    const fresh = await parseTeamImportFile({ fileName: 'registration-vinuni-sample.xlsx', fileBuffer })
    expect(() => applyTeamImportOverrides(fresh, [{ ...overrides[0], original: 'changed@example.edu' }])).toThrow(/Original value changed/)
  })
})
