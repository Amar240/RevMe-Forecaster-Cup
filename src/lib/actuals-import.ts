import crypto from 'crypto'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { getCurrentOperationalSeason } from '@/server/season'
import { logAuditAction } from '@/lib/audit'

const MAX_FILE_BYTES = 2 * 1024 * 1024

export const actualImportOverrideSchema = z.object({
  rowNumber: z.number().int().min(2).max(500),
  occupancy: z.number().min(0).max(100).optional(),
  adr: z.number().min(0).max(100_000).optional(),
  excluded: z.boolean().optional(),
})

export type ActualImportOverride = z.infer<typeof actualImportOverrideSchema>
export type ActualImportRow = {
  rowNumber: number
  roundNumber: number | null
  roundId: string | null
  marketName: string
  marketId: string | null
  weekOffset: number | null
  occupancy: number | null
  adr: number | null
  existingOccupancy: number | null
  existingAdr: number | null
  occupancyAction: 'CREATE' | 'REPLACE' | 'UNCHANGED' | 'INVALID'
  adrAction: 'CREATE' | 'REPLACE' | 'UNCHANGED' | 'INVALID'
  lockedOrScored: boolean
  excluded: boolean
  valid: boolean
  errors: string[]
  warnings: string[]
}

export type ActualImportPreview = {
  fileName: string
  fileHash: string
  rows: ActualImportRow[]
  summary: {
    sourceRows: number
    readyRows: number
    invalidRows: number
    excludedRows: number
    newValues: number
    changedValues: number
    unchangedValues: number
    lockedRows: number
  }
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++ } else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell.trim()); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++
      row.push(cell.trim()); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else {
      cell += char
    }
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function normalizedHeader(value: string) {
  return value.replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function numeric(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function changed(existing: number | null, value: number | null) {
  return existing !== null && value !== null && Math.abs(existing - value) > 0.000001
}

function action(existing: number | null, value: number | null, valid: boolean): ActualImportRow['occupancyAction'] {
  if (!valid || value === null) return 'INVALID'
  if (existing === null) return 'CREATE'
  return changed(existing, value) ? 'REPLACE' : 'UNCHANGED'
}

function decodeFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.csv')) throw new ApiError('Choose a CSV file downloaded from the actuals template.', 422, 'INVALID_INPUT')
  if (!file.size) throw new ApiError('The selected CSV file is empty.', 422, 'INVALID_INPUT')
  if (file.size > MAX_FILE_BYTES) throw new ApiError('The CSV file must be 2 MB or smaller.', 413, 'INVALID_INPUT')
  return file.arrayBuffer().then((buffer) => {
    const bytes = Buffer.from(buffer)
    if (bytes.includes(0)) throw new ApiError('This does not appear to be a text CSV file.', 422, 'INVALID_INPUT')
    return { bytes, text: bytes.toString('utf8'), fileHash: crypto.createHash('sha256').update(bytes).digest('hex') }
  })
}

export async function previewActualsImport(args: { file: File; overrides?: ActualImportOverride[] }) {
  const { bytes, text, fileHash } = await decodeFile(args.file)
  if (!bytes.length) throw new ApiError('The selected CSV file is empty.', 422, 'INVALID_INPUT')
  const grid = parseCsv(text)
  if (grid.length < 2) throw new ApiError('The CSV must contain the template header and at least one populated data row.', 422, 'INVALID_INPUT')

  const headers = grid[0].map(normalizedHeader)
  const required = ['round', 'market', 'weekoffset', 'occupancy']
  const adrHeader = headers.findIndex((header) => header === 'adr' || header === 'adr$')
  const indexes = {
    round: headers.indexOf('round'),
    market: headers.indexOf('market'),
    weekOffset: headers.indexOf('weekoffset'),
    occupancy: headers.indexOf('occupancy'),
    adr: adrHeader,
  }
  if (required.some((header) => headers.indexOf(header) < 0) || indexes.adr < 0) {
    throw new ApiError('The CSV headers do not match the actuals template. Download a fresh template and keep the Round, Market, WeekOffset, Occupancy, and ADR($) columns.', 422, 'INVALID_INPUT')
  }

  const season = await getCurrentOperationalSeason({ select: { id: true } })
  if (!season) throw new ApiError('No operational season is available.', 422, 'INVALID_INPUT')
  const [rounds, seasonMarkets, existing] = await Promise.all([
    prisma.round.findMany({ where: { seasonId: season.id }, orderBy: { number: 'asc' } }),
    prisma.seasonMarket.findMany({ where: { seasonId: season.id, isActive: true }, include: { market: true } }),
    prisma.actual.findMany({ where: { seasonId: season.id } }),
  ])
  const roundByNumber = new Map(rounds.map((round) => [round.number, round]))
  const marketByName = new Map(seasonMarkets.map((entry) => [entry.market.name.trim().toLowerCase(), entry.market]))
  const existingByKey = new Map(existing.map((actual) => [`${actual.roundId}:${actual.marketId}:${actual.weekOffset}:${actual.metric}`, actual]))
  const overrideByRow = new Map((args.overrides ?? []).map((override) => [override.rowNumber, override]))
  const duplicateKeys = new Map<string, number[]>()
  const sourceRows: ActualImportRow[] = []

  for (let index = 1; index < grid.length; index++) {
    const values = grid[index]
    const rowNumber = index + 1
    const rawOccupancy = numeric(values[indexes.occupancy] ?? '')
    const rawAdr = numeric(values[indexes.adr] ?? '')
    // Downloaded templates contain every expected season row. Rows whose two
    // editable value cells are still blank are intentionally not part of the import.
    if (rawOccupancy === null && rawAdr === null) continue

    const override = overrideByRow.get(rowNumber)
    const roundNumber = Number(values[indexes.round])
    const marketName = (values[indexes.market] ?? '').trim()
    const weekOffset = Number(values[indexes.weekOffset])
    const round = Number.isInteger(roundNumber) ? roundByNumber.get(roundNumber) : undefined
    const market = marketByName.get(marketName.toLowerCase())
    const occupancy = override?.occupancy ?? rawOccupancy
    const adr = override?.adr ?? rawAdr
    const errors: string[] = []
    const warnings: string[] = []

    if (!round) errors.push(`Round ${values[indexes.round] || '(blank)'} is not part of the operational season.`)
    if (!market) errors.push(`Market "${marketName || '(blank)'}" is not active for this season.`)
    if (!Number.isInteger(weekOffset) || ![1, 2].includes(weekOffset)) errors.push('WeekOffset must be 1 or 2.')
    if (round?.isFinal && weekOffset === 2) errors.push('The final round accepts WeekOffset 1 only.')
    if (occupancy === null || Number.isNaN(occupancy)) errors.push('Occupancy is required and must be a number.')
    else if (occupancy < 0 || occupancy > 100) errors.push('Occupancy must be between 0 and 100.')
    if (adr === null || Number.isNaN(adr)) errors.push('ADR is required and must be a number.')
    else if (adr < 0 || adr > 100_000) errors.push('ADR must be between 0 and 100,000.')

    const key = round && market && Number.isInteger(weekOffset) ? `${round.id}:${market.id}:${weekOffset}` : ''
    if (key) duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), rowNumber])
    const existingOccupancy = key ? existingByKey.get(`${key}:OCCUPANCY`) : undefined
    const existingAdr = key ? existingByKey.get(`${key}:ADR`) : undefined
    if (existingOccupancy?.isVoided || existingAdr?.isVoided) errors.push('This row contains a voided actual. Restore it from View Actuals before importing a replacement.')
    const lockedOrScored = Boolean(round?.isLockedActuals || round?.lastScoredAt)
    if (lockedOrScored) warnings.push('This round is locked or scored. A reason is required to save changes.')

    sourceRows.push({
      rowNumber,
      roundNumber: round?.number ?? (Number.isInteger(roundNumber) ? roundNumber : null),
      roundId: round?.id ?? null,
      marketName,
      marketId: market?.id ?? null,
      weekOffset: Number.isInteger(weekOffset) ? weekOffset : null,
      occupancy: Number.isFinite(occupancy) ? occupancy : null,
      adr: Number.isFinite(adr) ? adr : null,
      existingOccupancy: existingOccupancy?.value ?? null,
      existingAdr: existingAdr?.value ?? null,
      occupancyAction: 'INVALID',
      adrAction: 'INVALID',
      lockedOrScored,
      excluded: override?.excluded ?? false,
      valid: false,
      errors,
      warnings,
    })
  }

  for (const row of sourceRows) {
    const key = row.roundId && row.marketId && row.weekOffset ? `${row.roundId}:${row.marketId}:${row.weekOffset}` : ''
    const locations = key ? duplicateKeys.get(key) ?? [] : []
    if (locations.length > 1) row.errors.push(`Duplicate actual row also appears at rows ${locations.filter((item) => item !== row.rowNumber).join(', ')}.`)
    row.valid = !row.excluded && row.errors.length === 0
    row.occupancyAction = action(row.existingOccupancy, row.occupancy, row.valid)
    row.adrAction = action(row.existingAdr, row.adr, row.valid)
  }

  const included = sourceRows.filter((row) => !row.excluded)
  const actions = included.flatMap((row) => [row.occupancyAction, row.adrAction])
  const preview: ActualImportPreview = {
    fileName: args.file.name,
    fileHash,
    rows: sourceRows,
    summary: {
      sourceRows: sourceRows.length,
      readyRows: included.filter((row) => row.valid).length,
      invalidRows: included.filter((row) => !row.valid).length,
      excludedRows: sourceRows.filter((row) => row.excluded).length,
      newValues: actions.filter((item) => item === 'CREATE').length,
      changedValues: actions.filter((item) => item === 'REPLACE').length,
      unchangedValues: actions.filter((item) => item === 'UNCHANGED').length,
      lockedRows: included.filter((row) => row.valid && row.lockedOrScored && (row.occupancyAction === 'REPLACE' || row.adrAction === 'REPLACE' || row.occupancyAction === 'CREATE' || row.adrAction === 'CREATE')).length,
    },
  }
  return { preview, seasonId: season.id }
}

export async function confirmActualsImport(args: { actorId: string; file: File; fileHash: string; overrides?: ActualImportOverride[]; reason?: string }) {
  const { preview, seasonId } = await previewActualsImport({ file: args.file, overrides: args.overrides })
  if (preview.fileHash !== args.fileHash) throw new ApiError('The selected file changed after preview. Preview it again before confirming.', 409, 'CONFLICT')
  if (preview.summary.invalidRows) throw new ApiError('Resolve or remove every invalid row before confirming.', 422, 'INVALID_INPUT')
  if (!preview.summary.readyRows) throw new ApiError('No valid actual rows are ready to import.', 422, 'INVALID_INPUT')
  if (preview.summary.lockedRows && (!args.reason || args.reason.trim().length < 5)) throw new ApiError('Provide a reason of at least 5 characters for locked or scored rounds.', 422, 'INVALID_INPUT')

  const rows = preview.rows.filter((row) => row.valid && !row.excluded)
  const changedRows = rows.filter((row) => row.occupancyAction !== 'UNCHANGED' || row.adrAction !== 'UNCHANGED')
  const affectedLockedRounds = new Set(changedRows.filter((row) => row.lockedOrScored).map((row) => row.roundId!))
  await prisma.$transaction(async (tx) => {
    for (const row of changedRows) {
      for (const [metric, value, actionType] of [
        ['OCCUPANCY', row.occupancy, row.occupancyAction],
        ['ADR', row.adr, row.adrAction],
      ] as const) {
        if (actionType === 'UNCHANGED' || value === null) continue
        const existing = await tx.actual.findUnique({ where: { seasonId_roundId_marketId_metric_weekOffset: { seasonId, roundId: row.roundId!, marketId: row.marketId!, metric, weekOffset: row.weekOffset! } } })
        const actual = existing
          ? await tx.actual.update({ where: { id: existing.id }, data: { value, source: 'BULK', updatedById: args.actorId } })
          : await tx.actual.create({ data: { seasonId, roundId: row.roundId!, marketId: row.marketId!, metric, weekOffset: row.weekOffset!, value, source: 'BULK', createdById: args.actorId, updatedById: args.actorId } })
        await tx.actualValueRevision.create({ data: { actualId: actual.id, actorId: args.actorId, action: existing ? 'EDIT' : 'CREATE', oldValue: existing?.value ?? null, newValue: value, reason: row.lockedOrScored ? args.reason?.trim() : null } })
      }
    }
    for (const roundId of affectedLockedRounds) await tx.round.update({ where: { id: roundId }, data: { scoresStale: true, actualsVersion: { increment: 1 } } })
  })
  await logAuditAction(args.actorId, 'ACTUALS_BULK_IMPORTED', 'Season', seasonId, { fileName: preview.fileName, rowCount: changedRows.length, newValues: preview.summary.newValues, changedValues: preview.summary.changedValues, reason: args.reason?.trim() || null })
  return { message: 'Actuals imported successfully', summary: { ...preview.summary, writtenRows: changedRows.length } }
}
