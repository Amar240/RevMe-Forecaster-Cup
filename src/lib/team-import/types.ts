import type { SeasonStatus } from '@prisma/client'

export type TeamImportFileType = 'csv' | 'xlsx'
export type TeamImportFormat = 'legacy' | 'normalized'
export type TeamImportColumnLabel = 'Team' | 'Corresponding Team Member' | 'Additional Member 1' | 'Additional Member 2' | 'Additional Member 3' | 'Additional Member 4'
export type TeamImportOverrideField = 'teamName' | 'teamExternalId' | 'firstName' | 'lastName' | 'email'
export interface TeamImportOverride { rowNumber: number; columnLabel: TeamImportColumnLabel; field: TeamImportOverrideField; original: string; value: string }
export type TeamImportCanonicalField =
  | 'universityName' | 'teamExternalId' | 'teamName'
  | 'submitter.firstName' | 'submitter.lastName' | 'submitter.email'
  | `member${1 | 2 | 3 | 4}.${'firstName' | 'lastName' | 'email'}`
export interface TeamImportColumnMappingEntry { column: number; field: TeamImportCanonicalField; confidence: number }
export interface TeamImportColumnMapping { headerRowIndex: number; columnMap: TeamImportColumnMappingEntry[] }
export type ImportAssistOutcome = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export interface ImportAssistSuggestion {
  id: string
  useCase: 'LAYOUT' | 'REPAIR'
  rowNumber?: number
  columnLabel?: TeamImportColumnLabel
  field?: TeamImportOverrideField
  suggestion: string
  reason: string
  confidence: number
  outcome: ImportAssistOutcome
}

export interface TeamImportPersonInput {
  email: string
  firstName: string
  lastName: string
  provenance?: string
  warnings?: string[]
}

export interface TeamImportMetadata {
  universityName: string | null
  instructorName: string | null
  instructorEmail: string | null
  declaredTeamCount: number | null
}

export interface TeamImportPersonSummary {
  email: string
  firstName: string
  lastName: string
  displayName: string
  uploadedName: string | null
  matchedName: string | null
  nameMismatch: boolean
  willBeCreated: boolean
  provenance: string
}

export interface ParsedTeamImportRow {
  rowNumber: number
  format: TeamImportFormat
  universityName: string
  teamExternalId: string
  teamName: string
  supervisorEmail: string | null
  submitter: TeamImportPersonInput
  members: TeamImportPersonInput[]
}

export interface ParsedTeamImportFile {
  fileName: string
  fileType: TeamImportFileType
  detectedFormats: TeamImportFormat[]
  ignoredEmptyRows: number
  metadata: TeamImportMetadata
  warnings: string[]
  rows: ParsedTeamImportRow[]
}

export interface TeamImportPreviewRow {
  rowNumber: number
  format: TeamImportFormat
  teamExternalId: string
  teamName: string
  universityName: string
  supervisorEmail: string | null
  supervisorLabel: string | null
  submitterEmail: string
  submitter: TeamImportPersonSummary
  members: TeamImportPersonSummary[]
  memberCount: number
  valid: boolean
  autoMatchedSupervisor: boolean
  warnings: string[]
  warningCount: number
  errors: string[]
  excluded?: boolean
}

export interface TeamImportPreviewSummary {
  totalRows: number
  validRows: number
  invalidRows: number
  rowsWithWarnings: number
  ignoredEmptyRows: number
  fileType: TeamImportFileType
  detectedFormats: TeamImportFormat[]
  accountsToProvision: number
  existingAccounts: number
  excludedRows: number
}

export interface TeamImportSeasonSummary {
  id: string
  name: string
  status: SeasonStatus
}

export interface TeamImportPersonToProvision {
  email: string
  firstName: string
  lastName: string
  universityId: string
}

export interface ValidatedTeamImportRow {
  source: ParsedTeamImportRow
  preview: TeamImportPreviewRow
  seasonId: string
  universityId: string
  supervisorId: string
  submitterUserId: string | null
  memberUserIds: string[]
  peopleToProvision: TeamImportPersonToProvision[]
}

export interface TeamImportValidationResult {
  season: TeamImportSeasonSummary
  rows: TeamImportPreviewRow[]
  validRows: ValidatedTeamImportRow[]
  summary: TeamImportPreviewSummary
  metadata: TeamImportMetadata
  fileWarnings: string[]
}

export interface TeamImportResultRow {
  rowNumber: number
  teamExternalId: string
  teamName: string
  universityName: string
  submitterEmail: string
  submitter: TeamImportPersonSummary
  members: TeamImportPersonSummary[]
  memberCount: number
  status: 'created' | 'skipped'
  warnings: string[]
  warningCount: number
  reason?: string
  teamId?: string
  displayId?: string
}

export interface TeamImportResultSummary extends TeamImportPreviewSummary {
  teamsCreated: number
  skippedRows: number
  accountsProvisioned: number
}

export interface TeamImportConfirmResult {
  season: TeamImportSeasonSummary
  fileName: string
  summary: TeamImportResultSummary
  rows: TeamImportResultRow[]
}
