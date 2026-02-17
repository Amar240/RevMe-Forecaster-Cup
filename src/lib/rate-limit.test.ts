import { describe, expect, it, vi } from 'vitest'

describe('rateLimit', () => {
  it('enforces limit within the window and resets after window', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    vi.resetModules()
    const { rateLimit } = await import('./rate-limit')

    expect(rateLimit('key', 2, 1000)).toBe(true)
    expect(rateLimit('key', 2, 1000)).toBe(true)
    expect(rateLimit('key', 2, 1000)).toBe(false)

    vi.setSystemTime(1001)
    expect(rateLimit('key', 2, 1000)).toBe(true)
    vi.useRealTimers()
  })

  it('tracks keys independently', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    vi.resetModules()
    const { rateLimit } = await import('./rate-limit')

    expect(rateLimit('key-a', 1, 1000)).toBe(true)
    expect(rateLimit('key-a', 1, 1000)).toBe(false)
    expect(rateLimit('key-b', 1, 1000)).toBe(true)
    vi.useRealTimers()
  })
})
