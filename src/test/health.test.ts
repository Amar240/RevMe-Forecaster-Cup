import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/health/route'

describe('health route', () => {
  it('returns a no-store readiness response when the database is reachable', async () => {
    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(body.status).toBe('ok')
    expect(body.checks).toEqual({
      app: 'ok',
      db: 'ok',
    })
    expect(typeof body.timestamp).toBe('string')
  })
})
