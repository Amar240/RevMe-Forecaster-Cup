import { inflateRawSync } from 'zlib'
import { ApiError } from '@/server/http'
import type {
  ParsedTeamImportFile,
  ParsedTeamImportRow,
  TeamImportFileType,
  TeamImportPersonInput,
} from './types'

const XML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

const normalizedHeaderAliases = {
  universityName: new Set(['universityname', 'university', 'institution']),
  teamExternalId: new Set(['teamexternalid', 'externalteamid', 'teamid', 'teamidentifier']),
  teamName: new Set(['teamname', 'teamsselectedname', 'teamsselectednameoptional']),
  supervisorEmail: new Set(['supervisoremail']),
  submitterEmail: new Set(['submitteremail', 'correspondingteammemberemail', 'submitter']),
  submitterFirstName: new Set(['submitterfirstname']),
  submitterLastName: new Set(['submitterlastname']),
} as const

function decodeXmlText(value: string) {
  return value.replace(/&#(\d+);|&#x([0-9a-fA-F]+);|&([a-zA-Z]+);/g, (_, decimal, hex, entity) => {
    if (decimal) {
      return String.fromCodePoint(Number(decimal))
    }

    if (hex) {
      return String.fromCodePoint(parseInt(hex, 16))
    }

    return XML_ENTITY_MAP[entity] ?? `&${entity};`
  })
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? '').replace(/\r/g, '').trim()
}

function canonicalizeHeader(value: string | null | undefined) {
  return normalizeWhitespace(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isBlankRow(row: string[]) {
  return row.every((value) => !normalizeWhitespace(value))
}

function createPersonInput(
  email: string | undefined,
  firstName: string | undefined,
  lastName: string | undefined
): TeamImportPersonInput {
  return {
    email: email ?? '',
    firstName: firstName ?? '',
    lastName: lastName ?? '',
  }
}

function parseCsv(content: string) {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows.map((row) => row.map((cell) => normalizeWhitespace(cell)))
}

function findLegacyHeaderRow(rows: string[][]) {
  return rows.findIndex((row, index) => {
    const canonical = row.map(canonicalizeHeader)
    const nextRow = rows[index + 1] ?? []
    const nextCanonical = nextRow.map(canonicalizeHeader)
    const emailHeaderCount = nextCanonical.filter((value) => value === 'email').length

    return canonical.includes('institution') && canonical.includes('teamid') && emailHeaderCount >= 1
  })
}

function findNormalizedHeaderRow(rows: string[][]) {
  return rows.findIndex((row) => {
    const canonical = row.map(canonicalizeHeader)
    const matches =
      Number(canonical.some((value) => normalizedHeaderAliases.universityName.has(value))) +
      Number(canonical.some((value) => normalizedHeaderAliases.teamExternalId.has(value))) +
      Number(canonical.some((value) => normalizedHeaderAliases.submitterEmail.has(value))) +
      Number(canonical.some((value) => normalizedHeaderAliases.supervisorEmail.has(value))) +
      canonical.filter((value) => /^member\d+email$/.test(value)).length

    return matches >= 3
  })
}

function getHeaderIndex(row: string[], aliases: Set<string>) {
  return row.findIndex((value) => aliases.has(canonicalizeHeader(value)))
}

function getCellValue(row: string[], index: number) {
  return index >= 0 ? row[index] ?? '' : ''
}

function hasEmail(person: TeamImportPersonInput) {
  return Boolean(person.email.trim())
}

function getLegacyPersonColumns(subHeaderRow: string[]) {
  const people = subHeaderRow
    .map((value, index) => ({ value: canonicalizeHeader(value), index }))
    .filter((entry) => entry.value === 'email')
    .map((entry) => {
      const firstNameIndex =
        entry.index >= 2 && canonicalizeHeader(subHeaderRow[entry.index - 2] ?? '') === 'firstname'
          ? entry.index - 2
          : -1
      const lastNameIndex =
        entry.index >= 1 && canonicalizeHeader(subHeaderRow[entry.index - 1] ?? '') === 'lastname'
          ? entry.index - 1
          : -1

      return {
        firstNameIndex,
        lastNameIndex,
        emailIndex: entry.index,
      }
    })

  return {
    submitter: people[0] ?? null,
    members: people.slice(1),
  }
}

function parseLegacyWorkbookRows(rows: string[][]) {
  const headerRowIndex = findLegacyHeaderRow(rows)
  if (headerRowIndex === -1) {
    throw new ApiError('Unsupported workbook format', 422, 'INVALID_INPUT')
  }

  const groupHeaderRow = rows[headerRowIndex] ?? []
  const subHeaderRow = rows[headerRowIndex + 1] ?? []

  const institutionIndex = getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.universityName)
  const externalTeamIdIndex = getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.teamExternalId)
  const teamNameIndex = getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.teamName)

  const personColumns = getLegacyPersonColumns(subHeaderRow)

  if (!personColumns.submitter || institutionIndex === -1 || externalTeamIdIndex === -1) {
    throw new ApiError('Legacy workbook is missing required team columns', 422, 'INVALID_INPUT')
  }

  let ignoredEmptyRows = 0
  const parsedRows: ParsedTeamImportRow[] = []

  for (let rowIndex = headerRowIndex + 2; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    if (isBlankRow(row)) {
      ignoredEmptyRows += 1
      continue
    }

    const submitter = createPersonInput(
      getCellValue(row, personColumns.submitter.emailIndex),
      getCellValue(row, personColumns.submitter.firstNameIndex),
      getCellValue(row, personColumns.submitter.lastNameIndex)
    )

    const members = personColumns.members
      .map((person) =>
        createPersonInput(
          getCellValue(row, person.emailIndex),
          getCellValue(row, person.firstNameIndex),
          getCellValue(row, person.lastNameIndex)
        )
      )
      .filter(hasEmail)

    parsedRows.push({
      rowNumber: rowIndex + 1,
      format: 'legacy',
      universityName: getCellValue(row, institutionIndex),
      teamExternalId: getCellValue(row, externalTeamIdIndex),
      teamName: getCellValue(row, teamNameIndex),
      supervisorEmail: null,
      submitter,
      members,
    })
  }

  return {
    ignoredEmptyRows,
    rows: parsedRows,
  }
}

function parseNormalizedRows(rows: string[][]) {
  const headerRowIndex = findNormalizedHeaderRow(rows)
  if (headerRowIndex === -1) {
    throw new ApiError('Import file does not match the expected normalized template', 422, 'INVALID_INPUT')
  }

  const headerRow = rows[headerRowIndex] ?? []
  const institutionIndex = getHeaderIndex(headerRow, normalizedHeaderAliases.universityName)
  const externalTeamIdIndex = getHeaderIndex(headerRow, normalizedHeaderAliases.teamExternalId)
  const teamNameIndex = getHeaderIndex(headerRow, normalizedHeaderAliases.teamName)
  const supervisorEmailIndex = getHeaderIndex(headerRow, normalizedHeaderAliases.supervisorEmail)
  const submitterEmailIndex = getHeaderIndex(headerRow, normalizedHeaderAliases.submitterEmail)
  const submitterFirstNameIndex = getHeaderIndex(headerRow, normalizedHeaderAliases.submitterFirstName)
  const submitterLastNameIndex = getHeaderIndex(headerRow, normalizedHeaderAliases.submitterLastName)

  if (institutionIndex === -1 || externalTeamIdIndex === -1 || submitterEmailIndex === -1) {
    throw new ApiError('Import file is missing one or more required columns', 422, 'INVALID_INPUT')
  }

  const memberIndexes = Array.from(
    headerRow.reduce<Map<number, { emailIndex: number; firstNameIndex: number; lastNameIndex: number }>>(
      (map, value, index) => {
        const key = canonicalizeHeader(value)
        const emailMatch = key.match(/^member(\d+)email$/)
        if (emailMatch) {
          const position = Number(emailMatch[1])
          const existing = map.get(position) ?? { emailIndex: -1, firstNameIndex: -1, lastNameIndex: -1 }
          existing.emailIndex = index
          map.set(position, existing)
        }

        const firstNameMatch = key.match(/^member(\d+)firstname$/)
        if (firstNameMatch) {
          const position = Number(firstNameMatch[1])
          const existing = map.get(position) ?? { emailIndex: -1, firstNameIndex: -1, lastNameIndex: -1 }
          existing.firstNameIndex = index
          map.set(position, existing)
        }

        const lastNameMatch = key.match(/^member(\d+)lastname$/)
        if (lastNameMatch) {
          const position = Number(lastNameMatch[1])
          const existing = map.get(position) ?? { emailIndex: -1, firstNameIndex: -1, lastNameIndex: -1 }
          existing.lastNameIndex = index
          map.set(position, existing)
        }

        return map
      },
      new Map()
    ).entries()
  )
    .sort(([left], [right]) => left - right)
    .map(([, value]) => value)

  let ignoredEmptyRows = 0
  const parsedRows: ParsedTeamImportRow[] = []

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    if (isBlankRow(row)) {
      ignoredEmptyRows += 1
      continue
    }

    const submitter = createPersonInput(
      getCellValue(row, submitterEmailIndex),
      getCellValue(row, submitterFirstNameIndex),
      getCellValue(row, submitterLastNameIndex)
    )

    const members = memberIndexes
      .map((member) =>
        createPersonInput(
          getCellValue(row, member.emailIndex),
          getCellValue(row, member.firstNameIndex),
          getCellValue(row, member.lastNameIndex)
        )
      )
      .filter(hasEmail)

    parsedRows.push({
      rowNumber: rowIndex + 1,
      format: 'normalized',
      universityName: getCellValue(row, institutionIndex),
      teamExternalId: getCellValue(row, externalTeamIdIndex),
      teamName: getCellValue(row, teamNameIndex),
      supervisorEmail: getCellValue(row, supervisorEmailIndex) || null,
      submitter,
      members,
    })
  }

  return {
    ignoredEmptyRows,
    rows: parsedRows,
  }
}

function parseImportedRows(fileName: string, fileType: TeamImportFileType, rows: string[][]): ParsedTeamImportFile {
  const legacyHeaderRowIndex = fileType === 'xlsx' ? findLegacyHeaderRow(rows) : -1

  if (legacyHeaderRowIndex !== -1) {
    const parsed = parseLegacyWorkbookRows(rows)
    return {
      fileName,
      fileType,
      detectedFormats: ['legacy'],
      ignoredEmptyRows: parsed.ignoredEmptyRows,
      rows: parsed.rows,
    }
  }

  const parsed = parseNormalizedRows(rows)
  return {
    fileName,
    fileType,
    detectedFormats: ['normalized'],
    ignoredEmptyRows: parsed.ignoredEmptyRows,
    rows: parsed.rows,
  }
}

function getColumnIndex(cellReference: string) {
  const letters = cellReference.replace(/\d+/g, '')
  let result = 0

  for (const letter of letters) {
    result = result * 26 + (letter.charCodeAt(0) - 64)
  }

  return result - 1
}

function readZipEntries(buffer: Buffer) {
  const endSignature = 0x06054b50
  let endOffset = -1

  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 65557); index -= 1) {
    if (buffer.readUInt32LE(index) === endSignature) {
      endOffset = index
      break
    }
  }

  if (endOffset === -1) {
    throw new ApiError('Invalid XLSX file', 422, 'INVALID_INPUT')
  }

  const totalEntries = buffer.readUInt16LE(endOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16)
  const entries = new Map<string, Buffer>()

  let offset = centralDirectoryOffset
  for (let count = 0; count < totalEntries; count += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new ApiError('Invalid XLSX central directory', 422, 'INVALID_INPUT')
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraFieldLength = buffer.readUInt16LE(offset + 30)
    const fileCommentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength)

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize)

    let data: Buffer
    if (compressionMethod === 0) {
      data = Buffer.from(compressedData)
    } else if (compressionMethod === 8) {
      data = inflateRawSync(compressedData)
    } else {
      throw new ApiError('Unsupported XLSX compression method', 422, 'INVALID_INPUT')
    }

    entries.set(fileName, data)
    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength
  }

  return entries
}

function collectTextFragments(xmlFragment: string) {
  const matches = xmlFragment.matchAll(/<t(?:\s+xml:space="preserve")?>([\s\S]*?)<\/t>/g)
  return Array.from(matches, (match) => decodeXmlText(match[1]))
}

function parseSharedStrings(xml: string) {
  return Array.from(xml.matchAll(/<si\b[\s\S]*?<\/si>/g), (match) => collectTextFragments(match[0]).join(''))
}

function resolveFirstWorksheetPath(entries: Map<string, Buffer>) {
  if (entries.has('xl/worksheets/sheet1.xml')) {
    return 'xl/worksheets/sheet1.xml'
  }

  const workbookXml = entries.get('xl/workbook.xml')?.toString('utf8')
  const relationshipsXml = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8')
  if (!workbookXml || !relationshipsXml) {
    throw new ApiError('Workbook is missing sheet metadata', 422, 'INVALID_INPUT')
  }

  const firstSheetMatch = workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"/)
  if (!firstSheetMatch) {
    throw new ApiError('Workbook does not contain any sheets', 422, 'INVALID_INPUT')
  }

  const relationshipId = firstSheetMatch[1]
  const relationshipMatch = relationshipsXml.match(
    new RegExp(`<Relationship\\b[^>]*Id="${relationshipId}"[^>]*Target="([^"]+)"`, 'i')
  )

  if (!relationshipMatch) {
    throw new ApiError('Workbook is missing the first sheet reference', 422, 'INVALID_INPUT')
  }

  const target = relationshipMatch[1].replace(/^\.\//, '')
  return target.startsWith('xl/') ? target : `xl/${target.replace(/^\//, '')}`
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = []
  const rowMatches = xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)

  for (const match of rowMatches) {
    const rowNumber = Number(match[1])
    const rowContent = match[2]
    const row: string[] = []
    const cellMatches = rowContent.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>|<c\b([^>]*)\/>/g)

    for (const cellMatch of cellMatches) {
      const attributes = cellMatch[1] ?? cellMatch[3] ?? ''
      const cellContent = cellMatch[2] ?? ''
      const referenceMatch = attributes.match(/\br="([A-Z]+\d+)"/)
      if (!referenceMatch) {
        continue
      }

      const cellTypeMatch = attributes.match(/\bt="([^"]+)"/)
      const cellType = cellTypeMatch?.[1] ?? 'n'
      const columnIndex = getColumnIndex(referenceMatch[1])

      let value = ''
      if (cellType === 's') {
        const sharedIndex = Number(cellContent.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '-1')
        value = sharedIndex >= 0 ? sharedStrings[sharedIndex] ?? '' : ''
      } else if (cellType === 'inlineStr') {
        value = collectTextFragments(cellContent).join('')
      } else {
        value = decodeXmlText(cellContent.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '')
      }

      row[columnIndex] = normalizeWhitespace(value)
    }

    rows[rowNumber - 1] = row
  }

  return rows.map((row) => row ?? [])
}

function parseXlsx(buffer: Buffer) {
  const entries = readZipEntries(buffer)
  const sharedStringsXml = entries.get('xl/sharedStrings.xml')?.toString('utf8') ?? ''
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : []
  const worksheetPath = resolveFirstWorksheetPath(entries)
  const worksheetXml = entries.get(worksheetPath)?.toString('utf8')

  if (!worksheetXml) {
    throw new ApiError('Workbook could not be read', 422, 'INVALID_INPUT')
  }

  return parseWorksheetRows(worksheetXml, sharedStrings)
}

function getFileType(fileName: string): TeamImportFileType {
  const normalized = fileName.trim().toLowerCase()
  if (normalized.endsWith('.csv')) return 'csv'
  if (normalized.endsWith('.xlsx')) return 'xlsx'
  throw new ApiError('Only .csv and .xlsx files are supported', 422, 'INVALID_INPUT')
}

export async function parseTeamImportFile(args: {
  fileName: string
  fileBuffer: Buffer
}) {
  const fileName = args.fileName.trim() || 'team-import'
  const fileType = getFileType(fileName)
  const rows =
    fileType === 'csv'
      ? parseCsv(args.fileBuffer.toString('utf8'))
      : parseXlsx(args.fileBuffer)

  return parseImportedRows(fileName, fileType, rows)
}
