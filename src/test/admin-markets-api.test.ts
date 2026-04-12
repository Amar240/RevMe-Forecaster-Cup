import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loginAs } from './auth'
import { prisma } from './db'
import { createUniversity, createUser } from './fixtures'
import { makeRequest } from './http'

import { GET as getAdminMarkets, POST as postAdminMarkets } from '@/app/api/admin/markets/route'
import {
  PATCH as patchAdminMarket,
  DELETE as deleteAdminMarket,
} from '@/app/api/admin/markets/[id]/route'

const BASE = 'http://localhost:5000'
const LOCKED_MARKET_MESSAGE =
  'This market is already used in a started season and can no longer be changed.'

async function attachMarketToSeason(params: {
  marketId: string
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  name: string
}) {
  const season = await prisma.season.create({
    data: {
      name: params.name,
      status: params.status,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-02-01T00:00:00.000Z'),
      registrationOpen: true,
    },
  })

  await prisma.seasonMarket.create({
    data: {
      seasonId: season.id,
      marketId: params.marketId,
      isActive: true,
    },
  })

  return season
}

describe('admin markets API', () => {
  let admin: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    const university = await createUniversity('Admin Markets University')
    admin = await createUser({
      email: 'admin@markets.test',
      role: 'ADMIN',
      universityId: university.id,
    })
  })

  it('creates a market with a valid name', async () => {
    await loginAs(admin.id)

    const res = await postAdminMarkets(
      makeRequest(`${BASE}/api/admin/markets`, {
        method: 'POST',
        body: { name: 'Dubai' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.market.name).toBe('Dubai')

    const stored = await prisma.market.findUnique({ where: { id: data.market.id } })
    expect(stored?.name).toBe('Dubai')
  })

  it('trims whitespace before saving a market', async () => {
    await loginAs(admin.id)

    const res = await postAdminMarkets(
      makeRequest(`${BASE}/api/admin/markets`, {
        method: 'POST',
        body: { name: '  Hamburg  ' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.market.name).toBe('Hamburg')
  })

  it('collapses repeated internal whitespace before saving and duplicate comparison', async () => {
    await loginAs(admin.id)

    const createRes = await postAdminMarkets(
      makeRequest(`${BASE}/api/admin/markets`, {
        method: 'POST',
        body: { name: 'New   York' },
      })
    )
    const createData = await createRes.json()

    expect(createRes.status).toBe(201)
    expect(createData.market.name).toBe('New York')

    const duplicateRes = await postAdminMarkets(
      makeRequest(`${BASE}/api/admin/markets`, {
        method: 'POST',
        body: { name: ' new york ' },
      })
    )
    const duplicateData = await duplicateRes.json()

    expect(duplicateRes.status).toBe(409)
    expect(duplicateData.message).toBe('A market with this name already exists.')
  })

  it('rejects duplicate names case-insensitively', async () => {
    await prisma.market.create({
      data: { name: 'Dubai' },
    })

    await loginAs(admin.id)

    const res = await postAdminMarkets(
      makeRequest(`${BASE}/api/admin/markets`, {
        method: 'POST',
        body: { name: 'dubai' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.message).toBe('A market with this name already exists.')
  })

  it('rejects an empty market name', async () => {
    await loginAs(admin.id)

    const res = await postAdminMarkets(
      makeRequest(`${BASE}/api/admin/markets`, {
        method: 'POST',
        body: { name: '   ' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.message).toBe('Enter a market name.')
  })

  it('lists created markets in name order', async () => {
    await prisma.market.createMany({
      data: [{ name: 'Zurich' }, { name: 'Dubai' }, { name: 'Hamburg' }],
    })

    await loginAs(admin.id)

    const res = await getAdminMarkets()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.markets.map((market: { name: string }) => market.name)).toEqual([
      'Dubai',
      'Hamburg',
      'Nashville CBD',
      'Zurich',
    ])
  })

  it('returns lock metadata for locked and unlocked markets', async () => {
    const lockedMarket = await prisma.market.create({
      data: { name: 'Chicago Downtown' },
    })
    const draftMarket = await prisma.market.create({
      data: { name: 'Lisbon Central' },
    })

    await attachMarketToSeason({
      marketId: lockedMarket.id,
      status: 'ACTIVE',
      name: 'Started Market Season',
    })
    await attachMarketToSeason({
      marketId: draftMarket.id,
      status: 'DRAFT',
      name: 'Draft Market Season',
    })

    await loginAs(admin.id)

    const res = await getAdminMarkets()
    const data = await res.json()

    const locked = data.markets.find((market: { id: string }) => market.id === lockedMarket.id)
    const draftOnly = data.markets.find((market: { id: string }) => market.id === draftMarket.id)

    expect(res.status).toBe(200)
    expect(locked).toMatchObject({
      isLocked: true,
      lockReason: 'Used in a started season',
    })
    expect(draftOnly).toMatchObject({
      isLocked: false,
      lockReason: null,
    })
  })

  it('edits an unlocked market successfully', async () => {
    const market = await prisma.market.create({
      data: { name: 'Phoenix Metro' },
    })

    await loginAs(admin.id)

    const res = await patchAdminMarket(
      makeRequest(`${BASE}/api/admin/markets/${market.id}`, {
        method: 'PATCH',
        body: { name: ' Phoenix   Grand ' },
      }),
      { params: Promise.resolve({ id: market.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.market.name).toBe('Phoenix Grand')

    const stored = await prisma.market.findUnique({ where: { id: market.id } })
    expect(stored?.name).toBe('Phoenix Grand')
  })

  it('deletes an unlocked market successfully', async () => {
    const market = await prisma.market.create({
      data: { name: 'Sydney Harbour' },
    })

    await loginAs(admin.id)

    const res = await deleteAdminMarket(
      makeRequest(`${BASE}/api/admin/markets/${market.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: market.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toBe('Market deleted successfully')

    const stored = await prisma.market.findUnique({ where: { id: market.id } })
    expect(stored).toBeNull()
  })

  it('blocks edit for a market used by an ACTIVE season', async () => {
    const market = await prisma.market.create({
      data: { name: 'Tokyo Bay' },
    })
    await attachMarketToSeason({
      marketId: market.id,
      status: 'ACTIVE',
      name: 'Active Lock Season',
    })

    await loginAs(admin.id)

    const res = await patchAdminMarket(
      makeRequest(`${BASE}/api/admin/markets/${market.id}`, {
        method: 'PATCH',
        body: { name: 'Tokyo Core' },
      }),
      { params: Promise.resolve({ id: market.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe(LOCKED_MARKET_MESSAGE)
  })

  it('blocks delete for a market used by an ACTIVE season', async () => {
    const market = await prisma.market.create({
      data: { name: 'Berlin Mitte' },
    })
    await attachMarketToSeason({
      marketId: market.id,
      status: 'ACTIVE',
      name: 'Active Delete Lock Season',
    })

    await loginAs(admin.id)

    const res = await deleteAdminMarket(
      makeRequest(`${BASE}/api/admin/markets/${market.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: market.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe(LOCKED_MARKET_MESSAGE)
  })

  it('blocks edit for a market used by a PAUSED season', async () => {
    const market = await prisma.market.create({
      data: { name: 'Rome Centro' },
    })
    await attachMarketToSeason({
      marketId: market.id,
      status: 'PAUSED',
      name: 'Paused Lock Season',
    })

    await loginAs(admin.id)

    const res = await patchAdminMarket(
      makeRequest(`${BASE}/api/admin/markets/${market.id}`, {
        method: 'PATCH',
        body: { name: 'Rome Historic Center' },
      }),
      { params: Promise.resolve({ id: market.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe(LOCKED_MARKET_MESSAGE)
  })

  it('blocks delete for a market used by a COMPLETED season', async () => {
    const market = await prisma.market.create({
      data: { name: 'Madrid Centro' },
    })
    await attachMarketToSeason({
      marketId: market.id,
      status: 'COMPLETED',
      name: 'Completed Lock Season',
    })

    await loginAs(admin.id)

    const res = await deleteAdminMarket(
      makeRequest(`${BASE}/api/admin/markets/${market.id}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: market.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe(LOCKED_MARKET_MESSAGE)
  })

  it('rejects duplicate names case-insensitively during edit', async () => {
    const original = await prisma.market.create({
      data: { name: 'Athens' },
    })
    const market = await prisma.market.create({
      data: { name: 'Oslo' },
    })

    await loginAs(admin.id)

    const res = await patchAdminMarket(
      makeRequest(`${BASE}/api/admin/markets/${market.id}`, {
        method: 'PATCH',
        body: { name: ' athens ' },
      }),
      { params: Promise.resolve({ id: market.id }) }
    )
    const data = await res.json()

    expect(original.name).toBe('Athens')
    expect(res.status).toBe(409)
    expect(data.message).toBe('A market with this name already exists.')
  })

  it('includes a manage markets CTA in the season page empty state', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(dashboard)/admin/season/page.tsx'),
      'utf8'
    )

    expect(source).toContain('Manage Markets')
    expect(source).toContain('/admin/markets')
  })

  it('includes locked market copy in the admin markets page', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(dashboard)/admin/markets/page.tsx'),
      'utf8'
    )

    expect(source).toContain('Locked')
    expect(source).toContain('Used in a started season')
  })
})
