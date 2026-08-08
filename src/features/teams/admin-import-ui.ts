import type { ImportDiagnostic, ImportResolutionAction } from '@/lib/team-import/diagnostics'
import type { TeamImportPreviewRow } from '@/lib/team-import/types'

export type AdminImportRowFilter = 'ALL' | 'NEEDS_ATTENTION' | 'WARNINGS' | 'READY' | 'REMOVED'

export interface GroupedImportDiagnostic {
  key: string
  diagnostic: ImportDiagnostic
  rowNumbers: number[]
}

export function getAdminImportRowStatus(row: TeamImportPreviewRow) {
  if (row.excluded) return 'REMOVED' as const
  if (!row.valid) return 'NEEDS_ATTENTION' as const
  if (row.warningCount > 0) return 'WARNINGS' as const
  return 'READY' as const
}

export function filterAdminImportRows(
  rows: TeamImportPreviewRow[],
  filter: AdminImportRowFilter,
  searchQuery: string
) {
  const query = searchQuery.trim().toLowerCase()

  return rows.filter((row) => {
    if (filter !== 'ALL' && getAdminImportRowStatus(row) !== filter) return false
    if (!query) return true

    const haystack = [
      row.rowNumber,
      row.teamExternalId,
      row.teamName,
      row.universityName,
      row.supervisorLabel,
      row.supervisorEmail,
      row.submitter.displayName,
      row.submitter.email,
      ...row.members.flatMap((member) => [member.displayName, member.email]),
      ...row.warnings,
      ...row.errors,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function groupImportDiagnostics(rows: TeamImportPreviewRow[]) {
  const groups = new Map<string, GroupedImportDiagnostic>()

  for (const row of rows) {
    for (const diagnostic of row.diagnostics) {
      const key = [
        diagnostic.code,
        diagnostic.severity,
        diagnostic.title,
        diagnostic.explanation,
        diagnostic.resolution,
      ].join(':')
      const existing = groups.get(key)
      if (existing) {
        if (!existing.rowNumbers.includes(row.rowNumber)) existing.rowNumbers.push(row.rowNumber)
        continue
      }

      groups.set(key, {
        key,
        diagnostic,
        rowNumbers: [row.rowNumber],
      })
    }
  }

  return [...groups.values()]
    .map((group) => ({ ...group, rowNumbers: group.rowNumbers.sort((a, b) => a - b) }))
    .sort((a, b) => {
      if (a.diagnostic.severity !== b.diagnostic.severity) {
        return a.diagnostic.severity === 'ERROR' ? -1 : 1
      }
      return b.rowNumbers.length - a.rowNumbers.length
    })
}

export const IMPORT_RESOLUTION_LABELS: Record<ImportResolutionAction, string> = {
  EDIT_FIELD: 'Correct this value in the roster, then preview again.',
  MAP_COLUMNS: 'Match the source columns to RevME fields.',
  REPLACE_FILE: 'Choose a corrected file and preview it again.',
  DOWNLOAD_TEMPLATE: 'Start from a fresh RevME template.',
  REMOVE_ROW: 'Correct or remove the affected row before importing.',
  CONTACT_ADMIN: 'Review the related account or university in RevME.',
  RETRY: 'Preview the file again.',
  NONE: 'Review this information before continuing.',
}
