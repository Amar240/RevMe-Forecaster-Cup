import { beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { resetDatabase, prisma } from './db'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

declare global {
  // eslint-disable-next-line no-var
  var __testAuthToken: string | null
}

global.__testAuthToken = null

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === 'revme_session' && global.__testAuthToken) {
        return { value: global.__testAuthToken }
      }
      return undefined
    },
    set: () => {},
    delete: () => {},
  }),
}))

beforeAll(async () => {
  await resetDatabase()
})

beforeEach(async () => {
  await resetDatabase()
  global.__testAuthToken = null
})

afterAll(async () => {
  await prisma.$disconnect()
})
