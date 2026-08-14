import { describe, expect, it } from 'vitest'
import { formatForecastWeekLabel, forecastWeeksSummary } from '@/lib/forecast-weeks'

// Round 4 closes Fri Aug 14 2026 (7:59 PM EDT). Week +1 is the Sun–Sat week after: Aug 16–22.
const round4Close = '2026-08-14T23:59:00.000Z' // 7:59 PM EDT

describe('forecast week labels', () => {
  it('labels Week +1 as the Sun–Sat week after the deadline', () => {
    expect(formatForecastWeekLabel(round4Close, 1)).toBe('Week of Aug 16–22')
  })

  it('labels Week +2 as the following week', () => {
    expect(formatForecastWeekLabel(round4Close, 2)).toBe('Week of Aug 23–29')
  })

  it('summarizes both forecast weeks for the heading', () => {
    expect(forecastWeeksSummary(round4Close, [1, 2])).toBe('Aug 16–22 and Aug 23–29')
  })

  it('summarizes a single week for the final round', () => {
    expect(forecastWeeksSummary(round4Close, [1])).toBe('Aug 16–22')
  })

  it('spans month boundaries correctly', () => {
    // Close Fri Aug 28 2026 → next Sunday Aug 30 → Week Aug 30 – Sep 5.
    expect(formatForecastWeekLabel('2026-08-28T23:59:00.000Z', 1)).toBe('Week of Aug 30 – Sep 5')
  })
})
