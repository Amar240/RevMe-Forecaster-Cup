import { describe, expect, it } from 'vitest'
import { getSeasonDateBoundaries } from '@/server/season'

describe('season Eastern Time boundaries', () => {
  it('creates exact ET boundaries independently of the server timezone', () => {
    const winter = getSeasonDateBoundaries('2026-01-05')
    expect(winter.rounds[0].opensAt.toISOString()).toBe('2026-01-05T05:00:00.000Z')
    expect(winter.rounds[0].closesAt.toISOString()).toBe('2026-01-12T04:59:59.999Z')
    const daylight = getSeasonDateBoundaries('2026-07-06')
    expect(daylight.rounds[0].opensAt.toISOString()).toBe('2026-07-06T04:00:00.000Z')
    expect(daylight.rounds[0].closesAt.toISOString()).toBe('2026-07-13T03:59:59.999Z')
  })
})
