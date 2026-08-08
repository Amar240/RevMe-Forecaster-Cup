import { readFile } from 'fs/promises'
import { describe, expect, it } from 'vitest'
import { parseTeamImportFile } from '@/lib/team-import/parser'
import { applyTeamImportOverrides, cleanImportCell, parseTeamImportOverrides } from '@/lib/team-import/overrides'
import { buildRosterTemplate } from '@/lib/team-import/template'
import { columnMappingSchema } from '@/lib/team-import/assist'

describe('VinUniversity roster workbook parser', () => {
  it('accepts a legacy two-row registration form exported as CSV', async () => {
    const csv = [
      ',Your University,VinUniversity,,,,,,,,',
      ",Instructor's Name,Eric Olson,,,,,,,,",
      ",Instructor's Email,eolson23@msudenver.edu,,,,,,,,",
      ',Number of teams (no more than 10),6,,,,,,,,',
      ',,,,,,,,,,',
      ",,,Team's selected name (optional),Corresponding Team Member,,,Additional Team Members,,,",
      ',Institution,TeamID,,First Name,Last Name,Email,First Name,Last Name,Email',
      ',VinUniversity,VinUniversity1,,Linh Chi,Tran,23chi.tl@vinuni.edu.vn,Dieu Trang,Vu,23trang.vd@vinuni.edu.vn',
      ',VinUniversity,VinUniversity2,,Xuan Truong,Tran,24truong.tx@vinuni.edu.vn,Minh Anh,Nguyen,24anh.nm@vinuni.edu.vn',
      ',VinUniversity,VinUniversity3,,Canh Thuan,Thai,23thuan.tc@vinuni.edu.vn,Quang Minh,Le,23minh.lq@vinuni.edu.vn',
      ',VinUniversity,VinUniversity4,,Hoang Anh,Pham,24anh.ph@vinuni.edu.vn,Ngoc Linh,Tran,24linh.tn@vinuni.edu.vn',
      ',VinUniversity,VinUniversity5,,Duc Bao,Duy Hoang,24duy.hdb@vinuni.edu.vn,Thanh Dat,Nguyen,24dat.nt@vinuni.edu.vn',
      ',VinUniversity,VinUniversity6,,Anh Vu,Au,24vu.aa@vinuni.edu.vn,Van Anh,Nguyen,25anh.vn@vinuni.edu.vn',
    ].join('\n')

    const parsed = await parseTeamImportFile({
      fileName: 'Forecaster Cup Registration Form.csv',
      fileBuffer: Buffer.from(csv),
    })

    expect(parsed.fileType).toBe('csv')
    expect(parsed.detectedFormats).toEqual(['legacy'])
    expect(parsed.metadata).toEqual({
      universityName: 'VinUniversity',
      instructorName: 'Eric Olson',
      instructorEmail: 'eolson23@msudenver.edu',
      declaredTeamCount: 6,
    })
    expect(parsed.rows).toHaveLength(6)
    expect(parsed.rows.map((row) => row.teamExternalId)).toEqual([
      'VinUniversity1',
      'VinUniversity2',
      'VinUniversity3',
      'VinUniversity4',
      'VinUniversity5',
      'VinUniversity6',
    ])
    expect(parsed.rows[0].submitter).toMatchObject({
      firstName: 'Linh Chi',
      lastName: 'Tran',
      email: '23chi.tl@vinuni.edu.vn',
      provenance: 'Row 8 · Corresponding Team Member',
    })
  })

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

  it('selects Registration Form from the guided four-sheet template and excludes the separate example sheet', async () => {
    const fileBuffer = buildRosterTemplate({ universityName: 'University of Delaware', instructorName: 'Mara M', instructorEmail: 'mara@udel.edu' })
    const parsed = await parseTeamImportFile({ fileName: 'roster-template.xlsx', fileBuffer })

    expect(parsed.metadata).toMatchObject({
      universityName: 'University of Delaware',
      instructorName: 'Mara M',
      instructorEmail: 'mara@udel.edu',
    })
    expect(parsed.rows).toHaveLength(10)
    expect(parsed.rows[0]).toMatchObject({ rowNumber: 9, teamExternalId: 'University of Delaware1' })
    expect(parsed.rows.some((row) => row.teamExternalId.includes('EXAMPLE'))).toBe(false)
    expect(parsed.ignoredEmptyRows).toBe(0)
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

  it('parses an explicit AI-suggested mapping through the deterministic row DTO', async () => {
    const columnMapping = columnMappingSchema.parse({ headerRowIndex: 0, columnMap: [
      { column: 0, field: 'universityName', confidence: 0.9 }, { column: 1, field: 'teamExternalId', confidence: 0.9 },
      { column: 2, field: 'submitter.firstName', confidence: 0.9 }, { column: 3, field: 'submitter.lastName', confidence: 0.9 },
      { column: 4, field: 'submitter.email', confidence: 0.9 }, { column: 5, field: 'teamName', confidence: 0.8 },
    ] })
    const parsed = await parseTeamImportFile({ fileName: 'unusual.csv', fileBuffer: Buffer.from('School,Code,Given,Surname,Mailbox,Nickname\nAssist University,A-1,Ada,Lovelace,ADA@EXAMPLE.EDU,Analysts'), columnMapping })
    expect(parsed.rows[0]).toMatchObject({ universityName: 'Assist University', teamExternalId: 'A-1', teamName: 'Analysts', submitter: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.edu' } })
  })

  it('rejects duplicate columns and incomplete mappings', () => {
    expect(columnMappingSchema.safeParse({ headerRowIndex: 0, columnMap: [] }).success).toBe(false)
    expect(columnMappingSchema.safeParse({ headerRowIndex: 0, columnMap: [
      { column: 0, field: 'universityName', confidence: 1 }, { column: 0, field: 'teamExternalId', confidence: 1 },
      { column: 2, field: 'submitter.firstName', confidence: 1 }, { column: 3, field: 'submitter.lastName', confidence: 1 },
      { column: 4, field: 'submitter.email', confidence: 1 }, { column: 5, field: 'teamName', confidence: 1 },
    ] }).success).toBe(false)
  })
})
