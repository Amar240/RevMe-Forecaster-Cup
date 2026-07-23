export type DraftPredictions = Record<string, { occupancy: string; adr: string }>
export const DRAFT_VERSION = 1

export function draftKey(input: { userId: string; teamId: string; seasonId: string; roundId: string }) {
  return `revme:forecast-draft:v${DRAFT_VERSION}:${input.userId}:${input.teamId}:${input.seasonId}:${input.roundId}`
}

export function parseDraft(value: string | null): DraftPredictions | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { version?: number; predictions?: DraftPredictions }
    return parsed.version === DRAFT_VERSION && parsed.predictions && typeof parsed.predictions === 'object' ? parsed.predictions : null
  } catch { return null }
}

export function draftSavedAt(value: string | null) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as { version?: number; savedAt?: string }
    return parsed.version === DRAFT_VERSION && parsed.savedAt && !Number.isNaN(Date.parse(parsed.savedAt)) ? parsed.savedAt : null
  } catch { return null }
}

export function serializeDraft(predictions: DraftPredictions) {
  return JSON.stringify({ version: DRAFT_VERSION, savedAt: new Date().toISOString(), predictions })
}

export function contextualWarning(value: number, baseline: number | null, metric: 'OCCUPANCY' | 'ADR') {
  if (!Number.isFinite(value) || value <= 0) return null
  if (metric === 'OCCUPANCY' && value > 100) return 'Occupancy cannot exceed 100%.'
  if (metric === 'ADR' && (value < 20 || value > 2500)) return 'This ADR is outside the typical range. Check the order of magnitude.'
  if (baseline != null && baseline > 0) {
    const deviation = Math.abs(value - baseline) / baseline
    if (deviation >= 0.3) return `This is ${Math.round(deviation * 100)}% ${value > baseline ? 'above' : 'below'} the latest actual. Intentional?`
  }
  return null
}
