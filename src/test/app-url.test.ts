import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAppBaseUrl } from '@/lib/app-url'

describe('getAppBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses NEXT_PUBLIC_APP_URL as the canonical origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'staging.revme.example.com/')

    expect(getAppBaseUrl()).toBe('https://staging.revme.example.com')
  })

  it('falls back to localhost when NEXT_PUBLIC_APP_URL is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')

    expect(getAppBaseUrl()).toBe('http://localhost:5000')
  })
})
