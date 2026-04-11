import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import { createUniversity, createUser } from './fixtures'
import { ensureStandardMarkets, STANDARD_MARKET_NAMES } from '@/server/standard-markets'
import { GET as getMarketsHandler } from '@/app/api/admin/markets/route'
import { POST as createSeasonHandler } from '@/app/api/admin/season/route'

const BASE = 'http://localhost:5000'

describe('standard market bootstrap', () => {
  let admin: Awaited<ReturnType<typeof createUser>>
  let university: Awaited<ReturnType<typeof createUniversity>>

  beforeEach(async () => {
    university = await createUniversity('Market Bootstrap University')
    admin = await createUser({
      email: 'admin@market-bootstrap.test',
      role: 'ADMIN',
      universityId: university.id,
    })
  })

  it('creates the standard markets exactly once and keeps a stable order', async () => {
    const firstPass = await ensureStandardMarkets(prisma)
    const secondPass = await ensureStandardMarkets(prisma)
    const storedMarkets = await prisma.market.findMany({
      orderBy: { name: 'asc' },
    })

    expect(firstPass.map((market) => market.name)).toEqual([...STANDARD_MARKET_NAMES])
    expect(secondPass.map((market) => market.name)).toEqual([...STANDARD_MARKET_NAMES])
    expect(storedMarkets.map((market) => market.name)).toEqual([...STANDARD_MARKET_NAMES].sort())
    expect(storedMarkets).toHaveLength(3)
    expect(new Set(secondPass.map((market) => market.id)).size).toBe(3)
  })

  it('returns the bootstrapped markets from GET /api/admin/markets', async () => {
    await ensureStandardMarkets(prisma)
    await loginAs(admin.id)

    const res = await getMarketsHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.markets.map((market: { name: string }) => market.name)).toEqual([...STANDARD_MARKET_NAMES].sort())
  })

  it('GET /api/admin/markets bootstraps standard markets when the Market table is empty', async () => {
    await prisma.market.deleteMany()
    await loginAs(admin.id)

    const res = await getMarketsHandler()
    const data = await res.json()
    const storedMarkets = await prisma.market.findMany({
      orderBy: { name: 'asc' },
    })

    expect(res.status).toBe(200)
    expect(data.markets.map((market: { name: string }) => market.name)).toEqual([...STANDARD_MARKET_NAMES].sort())
    expect(storedMarkets.map((market) => market.name)).toEqual([...STANDARD_MARKET_NAMES].sort())
  })

  it('allows creating a season after bootstrapping the standard markets', async () => {
    const markets = await ensureStandardMarkets(prisma)
    await loginAs(admin.id)

    const res = await createSeasonHandler(
      makeRequest(`${BASE}/api/admin/season`, {
        method: 'POST',
        body: {
          name: 'Seeded Markets Season',
          startDate: '2026-09-01',
          endDate: '2026-10-20',
          totalRounds: 7,
          daysPerRound: 7,
          marketIds: markets.map((market) => market.id),
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.season.name).toBe('Seeded Markets Season')
    expect(data.season.markets).toHaveLength(3)
    expect(data.season.markets.map((entry: { market: { name: string } }) => entry.market.name).sort()).toEqual(
      [...STANDARD_MARKET_NAMES].sort()
    )

    const seasonMarkets = await prisma.seasonMarket.findMany({
      where: { seasonId: data.season.id },
    })
    expect(seasonMarkets).toHaveLength(3)
  })
})
