/**
 * Derives the human calendar week a "Week +N" forecast targets, using the round's existing dates —
 * no new stored fields. A round's deadline (`closesAt`) anchors the horizon: Week +1 is the Sun–Sat
 * week beginning the first Sunday after the deadline, Week +2 the week after that, etc. All boundaries
 * are computed in the competition's Eastern timezone so they don't drift near midnight.
 */

const EASTERN_TZ = 'America/New_York'

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

function easternCalendarParts(instant: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(instant)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

/** Start (Sunday) and end (Saturday) dates of the Week +offset forecast window for a round. */
export function forecastWeekRange(roundClosesAt: Date | string, weekOffset: number): { start: Date; end: Date } {
  const closes = new Date(roundClosesAt)
  const { year, month, day, weekday } = easternCalendarParts(closes)

  // Treat the Eastern calendar day as a floating date and do plain day arithmetic in UTC.
  const base = new Date(Date.UTC(year, month - 1, day))
  const daysUntilNextSunday = ((7 - weekday) % 7) || 7 // strictly after the deadline

  const start = new Date(base)
  start.setUTCDate(base.getUTCDate() + daysUntilNextSunday + (weekOffset - 1) * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { start, end }
}

/** e.g. "Week of Aug 16–22" (same month) or "Week of Aug 30 – Sep 5" (spanning months). */
export function formatForecastWeekLabel(roundClosesAt: Date | string, weekOffset: number): string {
  const { start, end } = forecastWeekRange(roundClosesAt, weekOffset)
  const monthDay = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(date)
  const dayOnly = (date: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', day: 'numeric' }).format(date)

  const startLabel = monthDay(start)
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()
  const endLabel = sameMonth ? dayOnly(end) : monthDay(end)
  const separator = sameMonth ? '–' : ' – '
  return `Week of ${startLabel}${separator}${endLabel}`
}

/** Short summary of all forecast weeks for a round, e.g. "Aug 16–22 and Aug 23–29". */
export function forecastWeeksSummary(roundClosesAt: Date | string, weekOffsets: number[]): string {
  const ranges = weekOffsets.map((offset) => formatForecastWeekLabel(roundClosesAt, offset).replace('Week of ', ''))
  if (ranges.length === 1) return ranges[0]
  return `${ranges.slice(0, -1).join(', ')} and ${ranges[ranges.length - 1]}`
}
