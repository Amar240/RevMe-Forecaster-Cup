import { deflateRawSync } from 'zlib'
import { TEAM_IMPORT_PERSON_LABELS } from './overrides'

export const ROSTER_TEMPLATE_VERSION = '2026.2'
export const ROSTER_MEMBER_GROUPS = TEAM_IMPORT_PERSON_LABELS
export const ROSTER_PERSON_HEADERS = ['First Name', 'Last Name', 'Email'] as const
export const ROSTER_TEAM_HEADERS = ['Institution', 'TeamID', "Team's selected name (optional)"] as const

export type RosterTemplateContext = {
  mode?: 'admin' | 'supervisor'
  seasonId?: string
  seasonName?: string
  universityId?: string
  universityName: string
  supervisorId?: string
  instructorName: string
  instructorEmail: string
  initialRows?: Array<{
    teamExternalId?: string
    teamName?: string
    people?: Array<{ firstName: string; lastName: string; email: string }>
  }>
}

function esc(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
function col(index: number) { let n = index + 1; let out = ''; while (n) { out = String.fromCharCode(65 + ((n - 1) % 26)) + out; n = Math.floor((n - 1) / 26) } return out }
function crc32(buffer: Buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0) } return (crc ^ 0xffffffff) >>> 0 }
function zip(entries: Array<{ name: string; content: string }>) { const local: Buffer[] = []; const central: Buffer[] = []; let offset = 0; for (const entry of entries) { const name = Buffer.from(entry.name); const source = Buffer.from(entry.content); const compressed = deflateRawSync(source); const checksum = crc32(source); const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(checksum, 14); h.writeUInt32LE(compressed.length, 18); h.writeUInt32LE(source.length, 22); h.writeUInt16LE(name.length, 26); local.push(h, name, compressed); const d = Buffer.alloc(46); d.writeUInt32LE(0x02014b50, 0); d.writeUInt16LE(20, 4); d.writeUInt16LE(20, 6); d.writeUInt16LE(8, 10); d.writeUInt32LE(checksum, 16); d.writeUInt32LE(compressed.length, 20); d.writeUInt32LE(source.length, 24); d.writeUInt16LE(name.length, 28); d.writeUInt32LE(offset, 42); central.push(d, name); offset += h.length + name.length + compressed.length } const cd = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); return Buffer.concat([...local, cd, end]) }
function cell(column: number, row: number, value: string, style = 0) { return value ? `<c r="${col(column)}${row}" t="inlineStr" s="${style}"><is><t>${esc(value)}</t></is></c>` : `<c r="${col(column)}${row}" s="${style}"/>` }
function worksheet(rows: string[][], styles: (row: number, column: number) => number, options: { freeze?: boolean; protect?: boolean; extras?: string } = {}) { const body = rows.map((values, ri) => `<row r="${ri + 1}">${values.map((value, ci) => cell(ci, ri + 1, value, styles(ri, ci))).join('')}</row>`).join(''); const pane = options.freeze ? '<pane ySplit="8" topLeftCell="A9" activePane="bottomLeft" state="frozen"/>' : ''; const protection = options.protect ? '<sheetProtection sheet="1" objects="1" scenarios="1" selectLockedCells="1" selectUnlockedCells="0"/>' : ''; return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><cols><col min="2" max="4" width="28" customWidth="1"/><col min="5" max="19" width="20" customWidth="1"/></cols><sheetData>${body}</sheetData>${protection}${options.extras ?? ''}</worksheet>` }

export function buildRosterTemplate(args: RosterTemplateContext) {
  const admin = args.mode === 'admin'
  const instructions = [
    ['RevME Forecaster Cup — Guided Team Roster'],
    ['Template version', ROSTER_TEMPLATE_VERSION],
    [''],
    ['Before you begin'],
    [`• This workbook is prepared for ${args.universityName || 'your university'} and ${args.instructorName || args.instructorEmail}.`],
    ['• Enter one team per row on the Registration Form sheet.'],
    ['• Team ID, submitter first name, last name, and university email are required.'],
    ['• The first person is the student who submits forecasts. Add up to four teammates.'],
    ['• Use one unique university email per person. Existing accounts are matched by email.'],
    ['• Do not rename sheets or headers, and do not paste over the protected context cells.'],
    ['• Review the Example sheet if you need a completed row. It is never imported.'],
    [admin ? '• Admin confirmation activates valid teams immediately.' : '• Supervisor confirmation sends valid teams for administrator approval.'],
  ]
  const section = ['', ...ROSTER_TEAM_HEADERS, ...ROSTER_MEMBER_GROUPS.flatMap((group) => [group, '', ''])]
  const headers = ['', '', '', '', ...ROSTER_MEMBER_GROUPS.flatMap(() => ROSTER_PERSON_HEADERS)]
  const entries = Array.from({ length: 10 }, (_, index) => {
    const initial = args.initialRows?.[index]
    const people = Array.from({ length: 5 }, (__, personIndex) => {
      const person = initial?.people?.[personIndex]
      return person ? [person.firstName, person.lastName, person.email] : ['', '', '']
    }).flat()
    return ['', args.universityName, initial?.teamExternalId ?? `${args.universityName}${index + 1}`, initial?.teamName ?? '', ...people]
  })
  const registration = [
    [],
    ['', 'University', args.universityName],
    ['', 'Supervisor', args.instructorName],
    ['', 'Supervisor Email', args.instructorEmail],
    ['', 'Season', args.seasonName ?? 'Current operational season'],
    [],
    section,
    headers,
    ...entries,
  ]
  const example = [
    ['Example only — do not copy this sheet into Registration Form'],
    section,
    headers,
    ['', args.universityName, `${args.universityName}1`, 'Revenue Rangers', 'Alex', 'Student', 'alex.student@university.edu', 'Jamie', 'Analyst', 'jamie.analyst@university.edu'],
  ]
  const metadata = [
    ['templateVersion', ROSTER_TEMPLATE_VERSION],
    ['mode', args.mode ?? 'supervisor'],
    ['seasonId', args.seasonId ?? ''],
    ['universityId', args.universityId ?? ''],
    ['universityName', args.universityName],
    ['supervisorId', args.supervisorId ?? ''],
    ['supervisorEmail', args.instructorEmail],
  ]
  const emailColumns = [6, 9, 12, 15, 18]
  const comments = `<?xml version="1.0" encoding="UTF-8"?><comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors><author>RevME</author></authors><commentList>${emailColumns.map((column) => `<comment ref="${col(column)}8" authorId="0"><text><t>Use the student's university email address. Each email may appear only once.</t></text></comment>`).join('')}</commentList></comments>`
  const sheetOverrides = [1, 2, 3, 4].map((sheet) => `<Override PartName="/xl/worksheets/sheet${sheet}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetOverrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/comments1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/></Types>`
  const styles = `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellXfs count="7"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="0" borderId="1" applyFont="1" applyBorder="1"/><xf fontId="0" fillId="0" borderId="1" applyBorder="1"><protection locked="0"/></xf><xf fontId="2" fillId="3" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf fontId="0" fillId="4" borderId="1" applyFill="1" applyBorder="1"><protection locked="0"/></xf><xf fontId="0" fillId="2" borderId="1" applyFill="1" applyBorder="1"/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/></cellXfs></styleSheet>`
  const registrationStyle = (row: number, column: number) => {
    if (row === 6 || row === 7) return 3
    if (row >= 8) return column === 1 ? 5 : (column === 2 || column >= 4 ? 4 : 2)
    if (row >= 1 && row <= 4 && column === 2) return 5
    return 0
  }
  return zip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Instructions" sheetId="1" r:id="rId1"/><sheet name="Registration Form" sheetId="2" r:id="rId2"/><sheet name="Example" sheetId="3" r:id="rId3"/><sheet name="_RevME Template" sheetId="4" state="hidden" r:id="rId4"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[1, 2, 3, 4].map((sheet) => `<Relationship Target="/xl/worksheets/sheet${sheet}.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Id="rId${sheet}"/>`).join('')}<Relationship Target="styles.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Id="rId5"/></Relationships>` },
    { name: 'xl/styles.xml', content: styles },
    { name: 'xl/worksheets/sheet1.xml', content: worksheet(instructions, (row) => row === 0 || row === 3 ? 6 : 0) },
    { name: 'xl/worksheets/sheet2.xml', content: worksheet(registration, registrationStyle, { freeze: true, protect: true, extras: '<legacyDrawing r:id="rId2"/>' }) },
    { name: 'xl/worksheets/sheet3.xml', content: worksheet(example, (row) => row === 1 || row === 2 ? 3 : row === 0 ? 6 : 2) },
    { name: 'xl/worksheets/sheet4.xml', content: worksheet(metadata, (row) => row === 0 ? 6 : 0) },
    { name: 'xl/worksheets/_rels/sheet2.xml.rels', content: `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="../comments1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Id="rId1"/><Relationship Target="../drawings/vmlDrawing1.vml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Id="rId2"/></Relationships>` },
    { name: 'xl/comments1.xml', content: comments },
    { name: 'xl/drawings/vmlDrawing1.vml', content: `<?xml version="1.0"?><xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:x="urn:schemas-microsoft-com:office:excel"><x:ClientData ObjectType="Note"/></xml>` },
  ])
}
