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
