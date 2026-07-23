import { describe, expect, it } from 'vitest'
import { contextualWarning, draftKey, draftSavedAt, parseDraft, serializeDraft } from '@/lib/submission-workspace'

describe('submission workspace', () => {
  it('isolates drafts by all scope identifiers', () => {
    expect(draftKey({ userId: 'u', teamId: 't', seasonId: 's', roundId: 'r' })).toContain(':u:t:s:r')
  })
  it('round trips versioned drafts and rejects malformed data', () => {
    const draft = { 'market-1': { occupancy: '70', adr: '150' } }
    expect(parseDraft(serializeDraft(draft))).toEqual(draft)
    expect(draftSavedAt(serializeDraft(draft))).toBeTruthy()
    expect(parseDraft('{bad')).toBeNull()
    expect(parseDraft(JSON.stringify({ version: 0, predictions: draft }))).toBeNull()
  })
  it('warns without changing valid input rules', () => {
    expect(contextualWarning(150, 75, 'OCCUPANCY')).toContain('cannot exceed')
    expect(contextualWarning(210, 100, 'ADR')).toContain('above')
    expect(contextualWarning(110, 100, 'ADR')).toBeNull()
    expect(contextualWarning(130, 100, 'ADR')).toContain('latest actual')
    expect(contextualWarning(129.99, 100, 'ADR')).toBeNull()
  })
})
