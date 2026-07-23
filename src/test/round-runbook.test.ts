import { describe, expect, it } from 'vitest'
import { deriveRoundRunbook, type RoundRunbookInput } from '@/server/round-runbook'

const NOW = new Date('2026-08-10T12:00:00.000Z')

function input(overrides: Partial<RoundRunbookInput> = {}): RoundRunbookInput {
  return {
    id: 'round-2',
    number: 2,
    opensAt: new Date('2026-08-08T12:00:00.000Z'),
    closesAt: new Date('2026-08-09T12:00:00.000Z'),
    isFinal: false,
    leaderboardReviewed: false,
    leaderboardVisible: false,
    participantsNotified: false,
    actualCount: 0,
    activeMarketCount: 3,
    scored: false,
    reminderDispatches: 4,
    submittedTeams: 4,
    activeTeams: 6,
    ...overrides,
  }
}

describe('round runbook derivation', () => {
  it('orders automatic milestones and blocks downstream faculty actions', () => {
    const result = deriveRoundRunbook(input(), NOW, 'current')
    expect(result.items.map((item) => item.key)).toEqual(['opens', 'reminders', 'closes', 'actuals', 'scoring', 'review', 'publish', 'notify'])
    expect(result.items.map((item) => item.status)).toEqual(['done', 'done', 'done', 'pending', 'blocked', 'blocked', 'blocked', 'blocked'])
    expect(result.items.find((item) => item.key === 'actuals')?.detail).toBe('0/12 values uploaded')
  })

  it('uses one horizon for the final round and completes every proven step', () => {
    const result = deriveRoundRunbook(input({ isFinal: true, actualCount: 6, scored: true, leaderboardReviewed: true, leaderboardVisible: true, participantsNotified: true }), NOW, 'current')
    expect(result.items.find((item) => item.key === 'actuals')?.detail).toBe('6/6 values uploaded')
    expect(result.items.every((item) => item.status === 'done')).toBe(true)
  })

  it('shows reminder timing before the round enters its reminder window', () => {
    const result = deriveRoundRunbook(input({ opensAt: new Date('2026-08-10T11:00:00.000Z'), closesAt: new Date('2026-08-13T12:00:00.000Z'), reminderDispatches: 0, submittedTeams: 0 }), NOW, 'current')
    const reminder = result.items.find((item) => item.key === 'reminders')
    expect(reminder).toMatchObject({ status: 'pending', detail: 'Scheduled at 48 and 24 hours' })
  })
})
