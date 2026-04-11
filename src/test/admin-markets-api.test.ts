import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { loginAs } from './auth'
import { prisma } from './db'
import { createUniversity, createUser } from './fixtures'
import { makeRequest } from './http'

import { GET as getAdminMarkets, POST as postAdminMarkets } from '@/app/api/admin/markets/route'

const BASE = 'http://localhost:5000'

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

  it('includes a manage markets CTA in the season page empty state', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/(dashboard)/admin/season/page.tsx'),
      'utf8'
    )

    expect(source).toContain('Manage Markets')
    expect(source).toContain('/admin/markets')
  })
})
