import { describe, expect, it } from 'vitest'
import {
  formatPersonOptionLabel,
  getMinimumRosterRequirementMessage,
  getRosterRestrictionMessage,
  isRosterBlockedStatus,
} from '@/features/teams/roster-ui'

describe('team roster UI helpers', () => {
  it('formats option labels as name and email when a full name is available', () => {
    expect(
      formatPersonOptionLabel({
        firstName: 'Jordan',
        lastName: 'Lee',
        email: 'jordan@example.com',
      })
    ).toBe('Jordan Lee (jordan@example.com)')
  })

  it('falls back to email-only labels when a name is missing', () => {
    expect(
      formatPersonOptionLabel({
        firstName: '',
        lastName: '',
        email: 'student@example.com',
      })
    ).toBe('student@example.com')
  })

  it('treats rejected, disqualified, and archived teams as roster-blocked statuses', () => {
    expect(isRosterBlockedStatus('REJECTED')).toBe(true)
    expect(isRosterBlockedStatus('DISQUALIFIED')).toBe(true)
    expect(isRosterBlockedStatus('ARCHIVED')).toBe(true)
    expect(isRosterBlockedStatus('ACTIVE')).toBe(false)
  })

  it('returns product-facing roster restriction messaging for blocked team statuses', () => {
    expect(getRosterRestrictionMessage('ARCHIVED')).toBe(
      'Member changes are unavailable while this team is archived.'
    )
    expect(getRosterRestrictionMessage('REJECTED')).toBe(
      'Member changes are unavailable while this team is rejected.'
    )
    expect(getRosterRestrictionMessage('DISQUALIFIED')).toBe(
      'Member changes are unavailable while this team is disqualified.'
    )
  })

  it('explains when a managed team must keep its last member', () => {
    expect(getMinimumRosterRequirementMessage('ACTIVE', 1)).toBe(
      'This team must keep at least one member in its current status.'
    )
    expect(getMinimumRosterRequirementMessage('APPROVED', 1)).toBe(
      'This team must keep at least one member in its current status.'
    )
    expect(getMinimumRosterRequirementMessage('DRAFT', 1)).toBe('')
    expect(getMinimumRosterRequirementMessage('ACTIVE', 2)).toBe('')
  })
})
