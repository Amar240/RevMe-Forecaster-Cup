import { beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { ensureTestSchema, resetDatabase, prisma } from './db'

declare global {
  // eslint-disable-next-line no-var
  var __testAuthToken: string | null
  // eslint-disable-next-line no-var
  var __testCookieOps: Array<{ type: 'set' | 'delete'; name: string; value?: string }>
  // eslint-disable-next-line no-var
  var __testCookies: Record<string, string>
}

global.__testAuthToken = null
global.__testCookieOps = []
global.__testCookies = {}

const sessionCookieNames = new Set(['revme_session', '__Secure-revme_session'])

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === 'revme_session' && global.__testAuthToken) {
        return { value: global.__testAuthToken }
      }
      if (name === '__Secure-revme_session' && global.__testAuthToken) {
        return { value: global.__testAuthToken }
      }
      return global.__testCookies[name] ? { value: global.__testCookies[name] } : undefined
    },
    set: (name: string, value: string) => {
      global.__testCookieOps.push({ type: 'set', name, value })
      global.__testCookies[name] = value
      if (sessionCookieNames.has(name)) {
        global.__testAuthToken = value
      }
    },
    delete: (name: string) => {
      global.__testCookieOps.push({ type: 'delete', name })
      delete global.__testCookies[name]
      if (sessionCookieNames.has(name)) {
        global.__testAuthToken = null
      }
    },
  }),
}))

beforeAll(async () => {
  await ensureTestSchema()
  await resetDatabase()
})

beforeEach(async () => {
  await resetDatabase()
  global.__testAuthToken = null
  global.__testCookieOps = []
  global.__testCookies = {}
})

afterAll(async () => {
  await prisma.$disconnect()
})
