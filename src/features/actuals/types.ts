export interface RoundSummary {
  id: string
  number: number
  isFinal?: boolean
  isLockedActuals?: boolean
  lockedAt?: string
  scoresStale?: boolean
  lastScoredAt?: string
  actualsVersion?: number
}

export interface MarketSummary {
  id: string
  name: string
}

export interface ActualSummary {
  id: string
  roundId: string
  roundNumber: number
  marketId: string
  marketName: string
  metric: 'OCCUPANCY' | 'ADR'
  weekOffset: number
  value: number
  source: 'MANUAL' | 'BULK'
  isVoided: boolean
  createdAt: string
  updatedAt: string
  createdBy: string | null
  updatedBy: string | null
}

export interface ActualRevision {
  id: string
  action: 'CREATE' | 'EDIT' | 'VOID' | 'UNVOID'
  oldValue: number | null
  newValue: number | null
  reason: string | null
  createdAt: string
  actor: string
  actorEmail: string
}

export interface ActualDetails extends ActualSummary {
  round: {
    isLockedActuals: boolean
    lastScoredAt: string | null
    scoresStale: boolean
  }
  revisions: ActualRevision[]
}

export interface ActualsResponse {
  actuals: ActualSummary[]
  rounds: RoundSummary[]
  totalActuals: number
  page: number
  pageSize: number
}

export interface ActualsSummaryResponse {
  actuals: ActualSummary[]
}

export interface ActualDetailsResponse {
  actual: ActualDetails
}

export interface ActualImportOverride {
  rowNumber: number
  occupancy?: number
  adr?: number
  excluded?: boolean
}

export interface ActualImportRow {
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

export interface ActualImportPreview {
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
