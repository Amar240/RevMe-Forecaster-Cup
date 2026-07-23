import { describe, expect, it } from 'vitest'
import { formatDeadline } from '@/components/dual-timezone-deadline'

describe('formatDeadline', () => {
  it('uses deterministic punctuation for Eastern deadlines', () => {
    expect(formatDeadline('2026-07-27T23:59:00.000Z', 'America/New_York')).toBe(
      'Mon, Jul 27, 7:59 PM EDT'
    )
  })
})
