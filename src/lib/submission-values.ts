export const OCCUPANCY_MIN = 0
export const OCCUPANCY_MAX = 100
export const ADR_MIN_EXCLUSIVE = 0

export type SubmissionMetric = 'OCCUPANCY' | 'ADR'

export function normalizeSubmissionValue(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return null
  }

  return value
}

export function isValidOccupancyValue(value: number): boolean {
  return Number.isFinite(value) && value >= OCCUPANCY_MIN && value <= OCCUPANCY_MAX
}

export function isValidAdrValue(value: number): boolean {
  return Number.isFinite(value) && value > ADR_MIN_EXCLUSIVE
}

export function isValidSubmissionMetricValue(metric: SubmissionMetric, value: number): boolean {
  return metric === 'OCCUPANCY' ? isValidOccupancyValue(value) : isValidAdrValue(value)
}

export function parseSubmissionMetricInput(metric: SubmissionMetric, raw: string): number | null {
  const value = normalizeSubmissionValue(raw)
  if (value === null) {
    return null
  }

  return isValidSubmissionMetricValue(metric, value) ? value : null
}

/**
 * Returns a specific, human-readable error for a single field's raw input, or null when the value
 * is acceptable. An EMPTY field returns null — emptiness is "incomplete", tracked by the progress
 * counter, not a validation error to shout about while the user is still working. This powers the
 * inline, per-field messages on the submit form.
 */
export function getSubmissionMetricError(metric: SubmissionMetric, raw: string): string | null {
  if (raw.trim() === '') {
    return null
  }

  const value = normalizeSubmissionValue(raw)
  if (value === null) {
    return metric === 'OCCUPANCY'
      ? 'Enter a number between 0 and 100.'
      : 'Enter an amount like 189.50.'
  }

  if (metric === 'OCCUPANCY' && !isValidOccupancyValue(value)) {
    return `Occupancy must be between ${OCCUPANCY_MIN} and ${OCCUPANCY_MAX}.`
  }

  if (metric === 'ADR' && !isValidAdrValue(value)) {
    return 'ADR must be greater than 0.'
  }

  return null
}
