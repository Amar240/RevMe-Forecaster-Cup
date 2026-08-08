import { inflateRawSync } from 'zlib'
import { ApiError } from '@/server/http'
import type {
  ParsedTeamImportFile,
  ParsedTeamImportRow,
  TeamImportColumnMapping,
  TeamImportCanonicalField,
  TeamImportFileType,
  TeamImportPersonInput,
  TeamImportMetadata,
} from './types'
import { cleanImportCell, TEAM_IMPORT_EXAMPLE_MARKER } from './overrides'
import { importErrorDetails } from './diagnostic-catalog'

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
  return cleanImportCell(value)
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
  lastName: string | undefined,
  provenance: string
): TeamImportPersonInput {
  const cleanFirstName = normalizeWhitespace(firstName)
  const cleanLastName = normalizeWhitespace(lastName)
  const warnings = !cleanLastName && /^(?:\p{Lu}[\p{L}'’-]*)(?:\s+\p{Lu}[\p{L}'’-]*)+/u.test(cleanFirstName)
    ? [`${provenance}: possible glued name — check split`]
    : []
  return {
    email: normalizeWhitespace(email).toLowerCase(),
    firstName: cleanFirstName,
    lastName: cleanLastName,
    provenance,
    warnings,
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

type LegacyHeaderLocation = {
  groupHeaderRowIndex: number
  subHeaderRowIndex: number
  dataStartRowIndex: number
}

function findLegacyHeader(rows: string[][]): LegacyHeaderLocation | null {
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const row = rows[index] ?? []
    const canonical = row.map(canonicalizeHeader)
    const nextRow = rows[index + 1] ?? []
    const nextCanonical = nextRow.map(canonicalizeHeader)
    const emailHeaderCount = nextCanonical.filter((value) => value === 'email').length

    if (canonical.includes('institution') && canonical.includes('teamid') && emailHeaderCount >= 1) {
      return { groupHeaderRowIndex: index, subHeaderRowIndex: index + 1, dataStartRowIndex: index + 2 }
    }

    const sameRowEmailHeaderCount = canonical.filter((value) => value === 'email').length
    if (canonical.includes('institution') && canonical.includes('teamid') && sameRowEmailHeaderCount >= 1) {
      return {
        groupHeaderRowIndex: Math.max(0, index - 1),
        subHeaderRowIndex: index,
        dataStartRowIndex: index + 1,
      }
    }
  }

  return null
}

function findNormalizedHeaderRow(rows: string[][]) {
  return rows.slice(0, 20).findIndex((row) => {
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

function harvestMetadata(rows: string[][]): TeamImportMetadata {
  const metadata: TeamImportMetadata = {
    universityName: null,
    instructorName: null,
    instructorEmail: null,
    declaredTeamCount: null,
  }

  for (const row of rows.slice(0, 20)) {
    const label = canonicalizeHeader(row[1])
    const value = normalizeWhitespace(row[2])
    if (!label || !value) continue
    if ((label === 'youruniversity' || label === 'university' || label === 'institution') && !metadata.universityName) metadata.universityName = value
    else if (label === 'instructorsname' || label === 'instructorname' || label === 'supervisor') metadata.instructorName = value
    else if (label === 'instructorsemail' || label === 'instructoremail' || label === 'supervisoremail') metadata.instructorEmail = value.toLowerCase()
    else if (label.startsWith('numberofteams')) {
      const parsed = Number(value)
      metadata.declaredTeamCount = Number.isInteger(parsed) && parsed >= 0 ? parsed : null
    }
  }
  return metadata
}

function getHeaderIndex(row: string[], aliases: Set<string>) {
  return row.findIndex((value) => aliases.has(canonicalizeHeader(value)))
}

function getCellValue(row: string[], index: number) {
  return index >= 0 ? row[index] ?? '' : ''
}

function hasPersonValue(person: TeamImportPersonInput) { return Boolean(person.email || person.firstName || person.lastName) }
function isExampleRow(row: string[]) { return row.some((value) => normalizeWhitespace(value) === TEAM_IMPORT_EXAMPLE_MARKER) }
function isTeamRow(row: string[], institutionIndex: number, externalTeamIdIndex: number, emailIndexes: number[]) {
  return Boolean(normalizeWhitespace(getCellValue(row, institutionIndex)) || normalizeWhitespace(getCellValue(row, externalTeamIdIndex)) || emailIndexes.some((index) => normalizeWhitespace(getCellValue(row, index))))
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
  const header = findLegacyHeader(rows)
  if (!header) {
    throw new ApiError('Unsupported workbook format', 422, 'INVALID_INPUT', { ...importErrorDetails('LAYOUT_UNRECOGNIZED', 'Unsupported workbook format'), assistEligibility: { layout: true } })
  }

  const groupHeaderRow = rows[header.groupHeaderRowIndex] ?? []
  const subHeaderRow = rows[header.subHeaderRowIndex] ?? []

  const institutionIndex = getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.universityName) >= 0
    ? getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.universityName)
    : getHeaderIndex(subHeaderRow, normalizedHeaderAliases.universityName)
  const externalTeamIdIndex = getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.teamExternalId) >= 0
    ? getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.teamExternalId)
    : getHeaderIndex(subHeaderRow, normalizedHeaderAliases.teamExternalId)
  const teamNameIndex = getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.teamName) >= 0
    ? getHeaderIndex(groupHeaderRow, normalizedHeaderAliases.teamName)
    : getHeaderIndex(subHeaderRow, normalizedHeaderAliases.teamName)

  const personColumns = getLegacyPersonColumns(subHeaderRow)

  if (!personColumns.submitter || institutionIndex === -1 || externalTeamIdIndex === -1) {
    throw new ApiError('Legacy workbook is missing required team columns', 422, 'INVALID_INPUT', { ...importErrorDetails('LAYOUT_REQUIRED_COLUMNS_MISSING', 'Legacy workbook is missing required team columns'), assistEligibility: { layout: true } })
  }

  let ignoredEmptyRows = 0
  const parsedRows: ParsedTeamImportRow[] = []

  for (let rowIndex = header.dataStartRowIndex; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    if (isBlankRow(row) || isExampleRow(row) || !isTeamRow(row, institutionIndex, externalTeamIdIndex, [personColumns.submitter.emailIndex, ...personColumns.members.map((person) => person.emailIndex)])) {
      ignoredEmptyRows += 1
      continue
    }

    const submitter = createPersonInput(
      getCellValue(row, personColumns.submitter.emailIndex),
      getCellValue(row, personColumns.submitter.firstNameIndex),
      getCellValue(row, personColumns.submitter.lastNameIndex),
      `Row ${rowIndex + 1} · Corresponding Team Member`
    )

    const members = personColumns.members
      .map((person, memberIndex) =>
        createPersonInput(
          getCellValue(row, person.emailIndex),
          getCellValue(row, person.firstNameIndex),
          getCellValue(row, person.lastNameIndex),
          `Row ${rowIndex + 1} · Additional Member ${memberIndex + 1}`
        )
      )
      .filter(hasPersonValue)

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
    throw new ApiError('Import file does not match the expected normalized template', 422, 'INVALID_INPUT', { ...importErrorDetails('LAYOUT_UNRECOGNIZED', 'Import file does not match the expected normalized template'), assistEligibility: { layout: true } })
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
    throw new ApiError('Import file is missing one or more required columns', 422, 'INVALID_INPUT', { ...importErrorDetails('LAYOUT_REQUIRED_COLUMNS_MISSING', 'Import file is missing one or more required columns'), assistEligibility: { layout: true } })
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
    if (isBlankRow(row) || isExampleRow(row) || !isTeamRow(row, institutionIndex, externalTeamIdIndex, [submitterEmailIndex, ...memberIndexes.map((member) => member.emailIndex)])) {
      ignoredEmptyRows += 1
      continue
    }

    const submitter = createPersonInput(
      getCellValue(row, submitterEmailIndex),
      getCellValue(row, submitterFirstNameIndex),
      getCellValue(row, submitterLastNameIndex),
      `Row ${rowIndex + 1} · Corresponding Team Member`
    )

    const members = memberIndexes
      .map((member, memberIndex) =>
        createPersonInput(
          getCellValue(row, member.emailIndex),
          getCellValue(row, member.firstNameIndex),
          getCellValue(row, member.lastNameIndex),
          `Row ${rowIndex + 1} · Additional Member ${memberIndex + 1}`
        )
      )
      .filter(hasPersonValue)

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
  const metadata = harvestMetadata(rows)
  // Header shape determines the roster format. Legacy registration forms are
  // valid whether they were saved as an Excel workbook or exported as CSV.
  const legacyHeader = findLegacyHeader(rows)

  if (legacyHeader) {
    const parsed = parseLegacyWorkbookRows(rows)
    return {
      fileName,
      fileType,
      detectedFormats: ['legacy'],
      ignoredEmptyRows: parsed.ignoredEmptyRows,
      metadata,
      warnings: metadata.declaredTeamCount !== null && metadata.declaredTeamCount !== parsed.rows.length
        ? [`Workbook declares ${metadata.declaredTeamCount} teams but ${parsed.rows.length} team rows were parsed.`]
        : [],
      rows: parsed.rows,
    }
  }

  const parsed = parseNormalizedRows(rows)
  return {
    fileName,
    fileType,
    detectedFormats: ['normalized'],
    ignoredEmptyRows: parsed.ignoredEmptyRows,
    metadata,
    warnings: metadata.declaredTeamCount !== null && metadata.declaredTeamCount !== parsed.rows.length
      ? [`Workbook declares ${metadata.declaredTeamCount} teams but ${parsed.rows.length} team rows were parsed.`]
      : [],
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
    throw new ApiError('This Excel workbook is damaged or incomplete. Save it again as .xlsx or use a fresh RevME template.', 422, 'INVALID_INPUT', importErrorDetails('WORKBOOK_UNREADABLE', 'This Excel workbook is damaged or incomplete. Save it again as .xlsx or use a fresh RevME template.'))
  }

  const totalEntries = buffer.readUInt16LE(endOffset + 10)
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16)
  const entries = new Map<string, Buffer>()
  let totalUncompressedBytes = 0
  const unsafe = (message: string): never => { throw new ApiError(message, 422, 'INVALID_INPUT', importErrorDetails('WORKBOOK_UNSAFE', message)) }
  if (totalEntries > 512) unsafe('This workbook contains too many internal files to process safely. Save the registration sheet into a new .xlsx file.')

  let offset = centralDirectoryOffset
  for (let count = 0; count < totalEntries; count += 1) {
    if (offset < 0 || offset + 46 > buffer.length) unsafe('This workbook has a damaged ZIP directory. Save it again as .xlsx.')
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      unsafe('This workbook has a damaged ZIP directory. Save it again as .xlsx.')
    }

    const flags = buffer.readUInt16LE(offset + 8)
    const compressionMethod = buffer.readUInt16LE(offset + 10)
    const compressedSize = buffer.readUInt32LE(offset + 20)
    const uncompressedSize = buffer.readUInt32LE(offset + 24)
    const fileNameLength = buffer.readUInt16LE(offset + 28)
    const extraFieldLength = buffer.readUInt16LE(offset + 30)
    const fileCommentLength = buffer.readUInt16LE(offset + 32)
    const localHeaderOffset = buffer.readUInt32LE(offset + 42)
    const fileName = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength)

    if (flags & 0x1) unsafe('Encrypted Excel workbooks are not supported. Remove workbook encryption and try again.')
    if (!fileName || fileName.startsWith('/') || fileName.includes('\\') || fileName.split('/').includes('..')) unsafe('This workbook contains an unsafe internal file path.')
    if (entries.has(fileName)) unsafe('This workbook contains duplicate internal files and cannot be processed safely.')
    if (uncompressedSize > 20 * 1024 * 1024) unsafe('This workbook contains an unusually large worksheet. Use the RevME template and include only roster data.')
    totalUncompressedBytes += uncompressedSize
    if (totalUncompressedBytes > 50 * 1024 * 1024) unsafe('This workbook expands beyond the safe processing limit. Use the RevME template and include only roster data.')
    if (compressedSize > 0 && uncompressedSize > 1024 * 1024 && uncompressedSize / compressedSize > 1000) unsafe('This workbook has an unsafe compression ratio. Save the roster into a new .xlsx file.')
    if (localHeaderOffset < 0 || localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) unsafe('This workbook contains a damaged worksheet entry.')

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
    const localExtraFieldLength = buffer.readUInt16LE(localHeaderOffset + 28)
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize)
    if (dataStart < 0 || dataStart + compressedSize > buffer.length) unsafe('This workbook contains an incomplete worksheet entry.')

    let data: Buffer = Buffer.alloc(0)
    if (compressionMethod === 0) {
      data = Buffer.from(compressedData)
    } else if (compressionMethod === 8) {
      data = inflateRawSync(compressedData)
    } else {
      unsafe('This workbook uses an unsupported compression method. Save it again as .xlsx.')
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

function xmlAttributes(fragment: string) {
  return Object.fromEntries(
    Array.from(fragment.matchAll(/(?:^|\s)([\w:-]+)="([^"]*)"/g), (match) => [match[1], decodeXmlText(match[2])])
  )
}

function normalizeWorksheetTarget(target: string) {
  const withoutFragment = target.split('#')[0].replace(/\\/g, '/')
  const rooted = withoutFragment.startsWith('/')
    ? withoutFragment.slice(1)
    : withoutFragment.startsWith('xl/')
      ? withoutFragment
      : `xl/${withoutFragment.replace(/^\.\//, '')}`
  const parts: string[] = []
  for (const part of rooted.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

function resolveFirstWorksheetPath(entries: Map<string, Buffer>) {
  const workbookXml = entries.get('xl/workbook.xml')?.toString('utf8')
  const relationshipsXml = entries.get('xl/_rels/workbook.xml.rels')?.toString('utf8')
  if (!workbookXml || !relationshipsXml) {
    // Retain compatibility with the minimal one-sheet XLSX files accepted by
    // the original importer and used by integrations that omit workbook rels.
    if (entries.has('xl/worksheets/sheet1.xml')) return 'xl/worksheets/sheet1.xml'
    throw new ApiError('Workbook is missing sheet metadata', 422, 'INVALID_INPUT', importErrorDetails('WORKBOOK_UNREADABLE', 'Workbook is missing sheet metadata'))
  }

  const sheets = Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/g), (match) => {
    const attributes = xmlAttributes(match[1])
    return { name: attributes.name, relationshipId: attributes['r:id'] }
  }).filter((sheet): sheet is { name: string; relationshipId: string } => Boolean(sheet.name && sheet.relationshipId))
  const supportedNames = ['Registration Form', 'Team Import']
  const selectedSheet = supportedNames
    .map((name) => sheets.find((sheet) => sheet.name.trim().toLowerCase() === name.toLowerCase()))
    .find(Boolean) ?? (sheets.length === 1 ? sheets[0] : undefined)
  if (!selectedSheet) {
    throw new ApiError('This workbook does not contain a supported roster sheet. Use “Registration Form” or “Team Import”, or download a fresh RevME template.', 422, 'INVALID_INPUT', importErrorDetails('LAYOUT_UNRECOGNIZED', 'This workbook does not contain a supported roster sheet. Use “Registration Form” or “Team Import”, or download a fresh RevME template.'))
  }

  const relationships = Array.from(relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi), (match) => xmlAttributes(match[1]))
  const relationship = relationships.find((item) => item.Id === selectedSheet.relationshipId)

  if (!relationship?.Target) {
    throw new ApiError('We could not read the worksheets in this Excel file. Save it again as an Excel Workbook (.xlsx) or use a fresh RevME template, then retry.', 422, 'INVALID_INPUT', importErrorDetails('WORKBOOK_UNREADABLE', 'We could not read the worksheets in this Excel file. Save it again as an Excel Workbook (.xlsx) or use a fresh RevME template, then retry.'))
  }

  return normalizeWorksheetTarget(relationship.Target)
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: string[][] = []
  const rowMatches = xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)

  for (const match of rowMatches) {
    const rowNumber = Number(match[1])
    const rowContent = match[2]
    const row: string[] = []
    const cellMatches = rowContent.matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g)

    for (const cellMatch of cellMatches) {
      const attributes = cellMatch[1] ?? cellMatch[2] ?? ''
      const cellContent = cellMatch[3] ?? ''
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
    throw new ApiError('Workbook could not be read', 422, 'INVALID_INPUT', importErrorDetails('WORKBOOK_UNREADABLE', 'Workbook could not be read'))
  }

  return parseWorksheetRows(worksheetXml, sharedStrings)
}

export function readTeamImportGrid(args: { fileName: string; fileBuffer: Buffer }) {
  const fileType = getFileType(args.fileName)
  return fileType === 'csv' ? parseCsv(args.fileBuffer.toString('utf8')) : parseXlsx(args.fileBuffer)
}

function parseMappedRows(fileName: string, fileType: TeamImportFileType, rows: string[][], mapping: TeamImportColumnMapping): ParsedTeamImportFile {
  const byField = new Map(mapping.columnMap.map((entry) => [entry.field, entry.column]))
  const at = (row: string[], field: TeamImportCanonicalField) => getCellValue(row, byField.get(field) ?? -1)
  const parsedRows: ParsedTeamImportRow[] = []
  let ignoredEmptyRows = 0
  for (let rowIndex = mapping.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []
    const emails = ['submitter.email', 'member1.email', 'member2.email', 'member3.email', 'member4.email'].map((field) => at(row, field as TeamImportCanonicalField))
    if (isBlankRow(row) || isExampleRow(row) || !(at(row, 'universityName') || at(row, 'teamExternalId') || emails.some(Boolean))) { ignoredEmptyRows += 1; continue }
    const person = (prefix: string, label: string) => createPersonInput(at(row, `${prefix}.email` as TeamImportCanonicalField), at(row, `${prefix}.firstName` as TeamImportCanonicalField), at(row, `${prefix}.lastName` as TeamImportCanonicalField), `Row ${rowIndex + 1} · ${label}`)
    parsedRows.push({
      rowNumber: rowIndex + 1,
      format: 'normalized',
      universityName: at(row, 'universityName'),
      teamExternalId: at(row, 'teamExternalId'),
      teamName: at(row, 'teamName'),
      supervisorEmail: null,
      submitter: person('submitter', 'Corresponding Team Member'),
      members: [1, 2, 3, 4].map((index) => person(`member${index}`, `Additional Member ${index}`)).filter(hasPersonValue),
    })
  }
  const metadata = harvestMetadata(rows)
  return { fileName, fileType, detectedFormats: ['normalized'], ignoredEmptyRows, metadata, warnings: [], rows: parsedRows }
}

export function getTeamImportHeaderCoverage(rows: string[][]) {
  const legacy = findLegacyHeader(rows)
  if (legacy) {
    const groups = rows[legacy.groupHeaderRowIndex] ?? []
    const subs = rows[legacy.subHeaderRowIndex] ?? []
    const teamCount = ['universityName', 'teamExternalId', 'teamName'].filter((field) => getHeaderIndex(groups, normalizedHeaderAliases[field as keyof typeof normalizedHeaderAliases]) >= 0 || getHeaderIndex(subs, normalizedHeaderAliases[field as keyof typeof normalizedHeaderAliases]) >= 0).length
    const people = getLegacyPersonColumns(subs)
    const personCount = [people.submitter, ...people.members].filter(Boolean).reduce((count, item) => count + [item!.firstNameIndex, item!.lastNameIndex, item!.emailIndex].filter((index) => index >= 0).length, 0)
    return Math.min(1, (teamCount + personCount) / 18)
  }
  const headerIndex = findNormalizedHeaderRow(rows)
  if (headerIndex < 0) return 0
  const canonical = (rows[headerIndex] ?? []).map(canonicalizeHeader)
  const known = new Set(Object.values(normalizedHeaderAliases).flatMap((aliases) => Array.from(aliases)).map(canonicalizeHeader))
  return Math.min(1, canonical.filter((value) => known.has(value) || /^member[1-4](firstname|lastname|email)$/.test(value)).length / 18)
}

function getFileType(fileName: string): TeamImportFileType {
  const normalized = fileName.trim().toLowerCase()
  if (normalized.endsWith('.csv')) return 'csv'
  if (normalized.endsWith('.xlsx')) return 'xlsx'
  throw new ApiError('Only .csv and .xlsx files are supported', 422, 'INVALID_INPUT', importErrorDetails('FILE_UNSUPPORTED', 'Only .csv and .xlsx files are supported'))
}

export async function parseTeamImportFile(args: {
  fileName: string
  fileBuffer: Buffer
  columnMapping?: TeamImportColumnMapping | null
}) {
  const fileName = args.fileName.trim() || 'team-import'
  const fileType = getFileType(fileName)
  const rows = readTeamImportGrid(args)
  try {
    return args.columnMapping ? parseMappedRows(fileName, fileType, rows, args.columnMapping) : parseImportedRows(fileName, fileType, rows)
  } catch (error) {
    if (error instanceof ApiError && error.details && typeof error.details === 'object' && 'assistEligibility' in error.details) {
      error.details = { ...error.details, mappingContext: { rows: rows.slice(0, 10) } }
    }
    throw error
  }
}
