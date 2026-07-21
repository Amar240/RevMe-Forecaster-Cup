import { describe, expect, it } from 'vitest'
import { deriveHomepageHeroStatusLabel, HOMEPAGE_DEFAULT_HERO_STATUS_LABEL } from '@/lib/homepage-season-status'

describe('deriveHomepageHeroStatusLabel', () => {
  it('shows the currently open round for an active season', () => {
    expect(
      deriveHomepageHeroStatusLabel({
        status: 'ACTIVE',
        rounds: [
          { number: 1, status: 'CLOSED' },
          { number: 2, status: 'CLOSED' },
          { number: 6, status: 'OPEN' },
          { number: 7, status: 'UPCOMING' },
        ],
      })
    ).toBe('Round 6 Live — Season in Progress')
  })

  it('shows a starts-soon badge for a draft season', () => {
    expect(
      deriveHomepageHeroStatusLabel({
        status: 'DRAFT',
        rounds: [{ number: 1, status: 'UPCOMING' }],
      })
    ).toBe('Season Starts Soon')
  })

  it('shows next round soon when an active season has no open round but has upcoming rounds', () => {
    expect(
      deriveHomepageHeroStatusLabel({
        status: 'ACTIVE',
        rounds: [
          { number: 1, status: 'CLOSED' },
          { number: 2, status: 'UPCOMING' },
        ],
      })
    ).toBe('Season Active — Next Round Soon')
  })

  it('shows next round soon for a paused operational season without an open round', () => {
    expect(
      deriveHomepageHeroStatusLabel({
        status: 'PAUSED',
        rounds: [
          { number: 4, status: 'CLOSED' },
          { number: 5, status: 'PAUSED' },
          { number: 6, status: 'UPCOMING' },
        ],
      })
    ).toBe('Season Active — Next Round Soon')
  })

  it('shows season complete for a completed season', () => {
    expect(
      deriveHomepageHeroStatusLabel({
        status: 'COMPLETED',
        rounds: [{ number: 7, status: 'CLOSED' }],
      })
    ).toBe('Season Complete')
  })

  it('shows season complete when an operational season has only closed rounds left', () => {
    expect(
      deriveHomepageHeroStatusLabel({
        status: 'ACTIVE',
        rounds: [
          { number: 1, status: 'CLOSED' },
          { number: 2, status: 'CLOSED' },
        ],
      })
    ).toBe('Season Complete')
  })

  it('falls back safely when there is no season', () => {
    expect(deriveHomepageHeroStatusLabel(null)).toBe(HOMEPAGE_DEFAULT_HERO_STATUS_LABEL)
  })

  it('falls back safely when the season has no usable round data', () => {
    expect(
      deriveHomepageHeroStatusLabel({
        status: 'ACTIVE',
        rounds: [],
      })
    ).toBe(HOMEPAGE_DEFAULT_HERO_STATUS_LABEL)
  })
})
