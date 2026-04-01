import { beforeEach, describe, expect, it } from 'vitest'
import {
  addTeamMember,
  createSeasonWithRounds,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'
import { parseTeamImportFile } from '@/lib/team-import/parser'
import { validateTeamImport } from '@/lib/team-import/validate'

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnLetter(index: number) {
  let value = index + 1
  let result = ''

  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }

  return result
}

function buildZip(entries: Array<{ name: string; content: string }>) {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8')
    const contentBuffer = Buffer.from(entry.content, 'utf8')

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0, 6)
    localHeader.writeUInt16LE(0, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(0, 14)
    localHeader.writeUInt32LE(contentBuffer.length, 18)
    localHeader.writeUInt32LE(contentBuffer.length, 22)
    localHeader.writeUInt16LE(nameBuffer.length, 26)
    localHeader.writeUInt16LE(0, 28)

    localParts.push(localHeader, nameBuffer, contentBuffer)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0, 8)
    centralHeader.writeUInt16LE(0, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(0, 16)
    centralHeader.writeUInt32LE(contentBuffer.length, 20)
    centralHeader.writeUInt32LE(contentBuffer.length, 24)
    centralHeader.writeUInt16LE(nameBuffer.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)

    centralParts.push(centralHeader, nameBuffer)
    offset += localHeader.length + nameBuffer.length + contentBuffer.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const endRecord = Buffer.alloc(22)
  endRecord.writeUInt32LE(0x06054b50, 0)
  endRecord.writeUInt16LE(0, 4)
  endRecord.writeUInt16LE(0, 6)
  endRecord.writeUInt16LE(entries.length, 8)
  endRecord.writeUInt16LE(entries.length, 10)
  endRecord.writeUInt32LE(centralDirectory.length, 12)
  endRecord.writeUInt32LE(offset, 16)
  endRecord.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, endRecord])
}

function buildWorksheetXml(rows: string[][]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cellXml = row
        .map((value, columnIndex) => {
          if (!value) return ''
          return `<c r="${columnLetter(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`
        })
        .join('')

      return `<row r="${rowIndex + 1}">${cellXml}</row>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`
}

function buildXlsx(rows: string[][]) {
  return buildZip([
    {
      name: 'xl/worksheets/sheet1.xml',
      content: buildWorksheetXml(rows),
    },
  ])
}

describe('team import parser and validation', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let secondUniversity: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let supervisor: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    university = await createUniversity('Import University')
    secondUniversity = await createUniversity('Other Import University')
    season = (await createSeasonWithRounds()).season
    supervisor = await createUser({
      email: 'supervisor@import.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    await createUser({
      email: 'admin@import.test',
      role: 'ADMIN',
      universityId: university.id,
    })
  })

  it('parses normalized CSV rows and ignores empty rows', async () => {
    const parsed = await parseTeamImportFile({
      fileName: 'teams.csv',
      fileBuffer: Buffer.from(
        [
          'universityName,teamExternalId,teamName,supervisorEmail,submitterEmail,submitterFirstName,submitterLastName,member1Email,member1FirstName,member1LastName,member2Email',
          ' Import University , ext-001 , Revenue Makers , SUPERVISOR@IMPORT.TEST , Submitter@Import.Test , Sam , Submitter , member1@import.test , Mona , Member , ',
          ',,,,,,',
        ].join('\n'),
        'utf8'
      ),
    })

    expect(parsed.fileType).toBe('csv')
    expect(parsed.detectedFormats).toEqual(['normalized'])
    expect(parsed.ignoredEmptyRows).toBe(1)
    expect(parsed.rows[0]).toMatchObject({
      format: 'normalized',
      universityName: 'Import University',
      teamExternalId: 'ext-001',
      teamName: 'Revenue Makers',
      supervisorEmail: 'SUPERVISOR@IMPORT.TEST',
      submitter: {
        email: 'Submitter@Import.Test',
        firstName: 'Sam',
        lastName: 'Submitter',
      },
      members: [
        {
          email: 'member1@import.test',
          firstName: 'Mona',
          lastName: 'Member',
        },
      ],
    })
  })

  it('parses normalized XLSX rows', async () => {
    const parsed = await parseTeamImportFile({
      fileName: 'teams.xlsx',
      fileBuffer: buildXlsx([
        ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail', 'submitterFirstName', 'submitterLastName', 'member1Email', 'member1FirstName', 'member1LastName'],
        ['Import University', 'xlsx-001', 'Workbook Team', 'supervisor@import.test', 'submitter@import.test', 'Casey', 'Creator', 'member1@import.test', 'Morgan', 'Member'],
      ]),
    })

    expect(parsed.fileType).toBe('xlsx')
    expect(parsed.detectedFormats).toEqual(['normalized'])
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].teamExternalId).toBe('xlsx-001')
    expect(parsed.rows[0].submitter.firstName).toBe('Casey')
    expect(parsed.rows[0].members[0].lastName).toBe('Member')
  })

  it('parses the legacy workbook layout and ignores name-only member slots without email', async () => {
    const parsed = await parseTeamImportFile({
      fileName: 'legacy.xlsx',
      fileBuffer: buildXlsx([
        [],
        [],
        [],
        [],
        ['', '', '', '', ''],
        ['', 'TeamNumber', 'Institution', 'TeamID', "Team's selected name (optional)", 'Corresponding Team Member (student who will submit the forecast every week)', '', '', 'Additional Team Members'],
        ['', '', '', '', '', 'First Name', 'Last Name', 'Email', 'First Name', 'Last Name', 'Email'],
        ['', '1', 'Import University', 'legacy-001', '', 'Sam', 'Submitter', 'submitter@import.test', 'Mona', 'Member', 'member1@import.test'],
        ['', '2', 'Import University', 'legacy-002', '', 'Taylor', 'Submitter', 'submitter2@import.test', 'NameOnly', 'Member', ''],
      ]),
    })

    expect(parsed.detectedFormats).toEqual(['legacy'])
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toMatchObject({
      format: 'legacy',
      universityName: 'Import University',
      teamExternalId: 'legacy-001',
      submitter: {
        email: 'submitter@import.test',
        firstName: 'Sam',
        lastName: 'Submitter',
      },
      members: [
        {
          email: 'member1@import.test',
          firstName: 'Mona',
          lastName: 'Member',
        },
      ],
    })
    expect(parsed.rows[1].members).toHaveLength(0)
  })

  it('validates fallback team name, same-university students, and global membership conflicts', async () => {
    const submitter = await createUser({
      email: 'submitter@import.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const member = await createUser({
      email: 'member1@import.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const assignedStudent = await createUser({
      email: 'assigned@import.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const existingTeam = await createTeam({
      name: 'Existing Team',
      displayId: 'T-EXISTING',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(existingTeam.id, assignedStudent.id, true)

    const parsed = await parseTeamImportFile({
      fileName: 'teams.csv',
      fileBuffer: Buffer.from(
        [
          'universityName,teamExternalId,teamName,supervisorEmail,submitterEmail,member1Email',
          'Import University,ok-001,,supervisor@import.test,submitter@import.test,member1@import.test',
          'Import University,bad-001,,supervisor@import.test,assigned@import.test,member1@import.test',
        ].join('\n'),
        'utf8'
      ),
    })

    const validation = await validateTeamImport({
      seasonId: season.id,
      parsedFile: parsed,
    })

    expect(submitter.email).toBe('submitter@import.test')
    expect(member.email).toBe('member1@import.test')
    expect(validation.summary.validRows).toBe(1)
    expect(validation.rows[0].teamName).toBe('ok-001')
    expect(validation.rows[1].errors.join(' ')).toContain('already assigned')
  })

  it('rejects duplicate identifiers, invalid students, and duplicate emails', async () => {
    await createUser({
      email: 'supervisor2@import.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    await createUser({
      email: 'submitter2@import.test',
      role: 'STUDENT',
      universityId: secondUniversity.id,
    })
    await createUser({
      email: 'member2@import.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    await createTeam({
      name: 'Already Imported',
      displayId: 'T-IMPORTED',
      externalTeamId: 'dup-001',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    const parsed = await parseTeamImportFile({
      fileName: 'teams.csv',
      fileBuffer: Buffer.from(
        [
          'universityName,teamExternalId,teamName,supervisorEmail,submitterEmail,member1Email',
          'Import University,dup-001,,supervisor@import.test,submitter2@import.test,submitter2@import.test',
          'Import University,dup-001,,supervisor@import.test,missing-email,member2@import.test',
        ].join('\n'),
        'utf8'
      ),
    })

    const validation = await validateTeamImport({
      seasonId: season.id,
      parsedFile: parsed,
    })

    expect(validation.summary.validRows).toBe(0)
    expect(validation.rows[0].errors.join(' ')).toContain('already used')
    expect(validation.rows[0].errors.join(' ')).toContain('Duplicate team member email')
    expect(validation.rows[0].errors.join(' ')).toContain('same university')
    expect(validation.rows[1].errors.join(' ')).toContain('appears more than once')
    expect(validation.rows[1].errors.join(' ')).toContain('Submitter email is not valid')
  })

  it('supports legacy auto-match only when exactly one eligible supervisor exists', async () => {
    await createUser({
      email: 'submitter3@import.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    await createUser({
      email: 'member3@import.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const parsed = await parseTeamImportFile({
      fileName: 'legacy.xlsx',
      fileBuffer: buildXlsx([
        [],
        [],
        [],
        [],
        ['', '', '', '', ''],
        ['', 'TeamNumber', 'Institution', 'TeamID', "Team's selected name (optional)", 'Corresponding Team Member (student who will submit the forecast every week)', '', '', 'Additional Team Members'],
        ['', '', '', '', '', 'First Name', 'Last Name', 'Email', 'First Name', 'Last Name', 'Email'],
        ['', '1', 'Import University', 'legacy-auto-001', '', 'Sam', 'Submitter', 'submitter3@import.test', 'Mona', 'Member', 'member3@import.test'],
      ]),
    })

    const validation = await validateTeamImport({
      seasonId: season.id,
      parsedFile: parsed,
    })

    expect(validation.summary.validRows).toBe(1)
    expect(validation.rows[0].autoMatchedSupervisor).toBe(true)

    await createUser({
      email: 'second-supervisor@import.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })

    const invalidValidation = await validateTeamImport({
      seasonId: season.id,
      parsedFile: parsed,
    })

    expect(invalidValidation.summary.validRows).toBe(0)
    expect(invalidValidation.rows[0].errors.join(' ')).toContain('multiple supervisors')
  })

  it('adds advisory warnings for meaningful name mismatches without blocking the row', async () => {
    await createUser({
      email: 'submitter4@import.test',
      role: 'STUDENT',
      firstName: 'Jacob',
      lastName: 'Perreault',
      universityId: university.id,
    })
    await createUser({
      email: 'member4@import.test',
      role: 'STUDENT',
      firstName: 'Mona',
      lastName: 'Member',
      universityId: university.id,
    })

    const parsed = await parseTeamImportFile({
      fileName: 'teams.csv',
      fileBuffer: Buffer.from(
        [
          'universityName,teamExternalId,teamName,supervisorEmail,submitterEmail,submitterFirstName,submitterLastName,member1Email,member1FirstName,member1LastName',
          'Import University,warn-001,,supervisor@import.test,submitter4@import.test,Jake,Perreault,member4@import.test,Mona,Member',
        ].join('\n'),
        'utf8'
      ),
    })

    const validation = await validateTeamImport({
      seasonId: season.id,
      parsedFile: parsed,
    })

    expect(validation.summary.validRows).toBe(1)
    expect(validation.summary.rowsWithWarnings).toBe(1)
    expect(validation.rows[0].warningCount).toBe(1)
    expect(validation.rows[0].warnings[0]).toContain('uploaded "Jake Perreault"')
    expect(validation.rows[0].warnings[0]).toContain('matched system user "Jacob Perreault"')
    expect(validation.rows[0].submitter.nameMismatch).toBe(true)
    expect(validation.rows[0].submitter.matchedName).toBe('Jacob Perreault')
  })

  it('does not warn for case or punctuation-only name differences', async () => {
    await createUser({
      email: 'submitter5@import.test',
      role: 'STUDENT',
      firstName: 'Jo-Anne',
      lastName: "O'Connor",
      universityId: university.id,
    })

    const parsed = await parseTeamImportFile({
      fileName: 'teams.csv',
      fileBuffer: Buffer.from(
        [
          'universityName,teamExternalId,teamName,supervisorEmail,submitterEmail,submitterFirstName,submitterLastName',
          'Import University,warn-002,,supervisor@import.test,submitter5@import.test, jo anne , oconnor ',
        ].join('\n'),
        'utf8'
      ),
    })

    const validation = await validateTeamImport({
      seasonId: season.id,
      parsedFile: parsed,
    })

    expect(validation.summary.validRows).toBe(1)
    expect(validation.summary.rowsWithWarnings).toBe(0)
    expect(validation.rows[0].warningCount).toBe(0)
    expect(validation.rows[0].submitter.nameMismatch).toBe(false)
  })

  it('enforces the supervisor cap during validation', async () => {
    const universityStudentEmails = Array.from({ length: 2 }, (_, index) => `cap-student-${index}@import.test`)
    for (const email of universityStudentEmails) {
      await createUser({
        email,
        role: 'STUDENT',
        universityId: university.id,
      })
    }

    for (let index = 0; index < 10; index += 1) {
      await createTeam({
        name: `Managed ${index}`,
        displayId: `T-CAP-${index}`,
        supervisorId: supervisor.id,
        universityId: university.id,
        seasonId: season.id,
        status: 'ACTIVE',
      })
    }

    const parsed = await parseTeamImportFile({
      fileName: 'teams.csv',
      fileBuffer: Buffer.from(
        [
          'universityName,teamExternalId,teamName,supervisorEmail,submitterEmail,member1Email',
          `Import University,cap-001,,supervisor@import.test,${universityStudentEmails[0]},${universityStudentEmails[1]}`,
        ].join('\n'),
        'utf8'
      ),
    })

    const validation = await validateTeamImport({
      seasonId: season.id,
      parsedFile: parsed,
    })

    expect(validation.summary.validRows).toBe(0)
    expect(validation.rows[0].errors.join(' ')).toContain('maximum of 10 teams')
  })
})
