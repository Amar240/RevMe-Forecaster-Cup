import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from './db'
import { loginAs } from './auth'
import { createMarkets, createSeasonWithRounds, createUser } from './fixtures'
import { POST as previewActuals } from '@/app/api/admin/actuals/import/preview/route'
import { POST as confirmActuals } from '@/app/api/admin/actuals/import/confirm/route'

function request(url: string, csv: string, options: { fileHash?: string; overrides?: unknown[]; reason?: string } = {}) {
  const form = new FormData()
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'actuals.csv')
  form.append('overrides', JSON.stringify(options.overrides ?? []))
  if (options.fileHash) form.append('fileHash', options.fileHash)
  if (options.reason) form.append('reason', options.reason)
  return new NextRequest(url, { method: 'POST', body: form })
}

describe('actuals CSV import', () => {
  async function setup() {
    const admin = await createUser({ email: 'actual-import-admin@test.edu', role: 'ADMIN' })
    const { season, rounds } = await createSeasonWithRounds({ name: 'Actual Import Season' })
    const markets = await createMarkets(season.id)
    await loginAs(admin.id)
    return { admin, season, rounds, markets }
  }

  it('previews populated template rows, skips blank template rows, and imports atomically', async () => {
    const { season, rounds, markets } = await setup()
    const csv = [
      'Round,Market,WeekOffset,Occupancy,ADR($)',
      `1,${markets[0].name},1,78.4,289.50`,
      `1,${markets[0].name},2,81.2,304.75`,
      `2,${markets[0].name},1,,`,
    ].join('\n')

    const previewResponse = await previewActuals(request('http://localhost/api/admin/actuals/import/preview', csv))
    const preview = await previewResponse.json()
    expect(previewResponse.status).toBe(200)
    expect(preview.summary).toMatchObject({ sourceRows: 2, readyRows: 2, invalidRows: 0, newValues: 4 })

    const confirmResponse = await confirmActuals(request('http://localhost/api/admin/actuals/import/confirm', csv, { fileHash: preview.fileHash }))
    expect(confirmResponse.status).toBe(200)
    expect(await prisma.actual.count({ where: { seasonId: season.id, roundId: rounds[0].id } })).toBe(4)
    expect(await prisma.actualValueRevision.count({ where: { actual: { seasonId: season.id } } })).toBe(4)
    expect(await prisma.auditLog.count({ where: { action: 'ACTUALS_BULK_IMPORTED', entityId: season.id } })).toBe(1)
  })

  it('shows replacements, revalidates overrides, and requires a reason for a scored round', async () => {
    const { admin, season, rounds, markets } = await setup()
    const initialActualsVersion = rounds[0].actualsVersion
    await prisma.round.update({ where: { id: rounds[0].id }, data: { lastScoredAt: new Date() } })
    await prisma.actual.createMany({ data: [
      { seasonId: season.id, roundId: rounds[0].id, marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 70, createdById: admin.id, updatedById: admin.id },
      { seasonId: season.id, roundId: rounds[0].id, marketId: markets[0].id, metric: 'ADR', weekOffset: 1, value: 200, createdById: admin.id, updatedById: admin.id },
    ] })
    const csv = `Round,Market,WeekOffset,Occupancy,ADR($)\n1,${markets[0].name},1,72,210`
    const previewResponse = await previewActuals(request('http://localhost/api/admin/actuals/import/preview', csv, { overrides: [{ rowNumber: 2, occupancy: 73 }] }))
    const preview = await previewResponse.json()
    expect(preview.rows[0]).toMatchObject({ occupancy: 73, occupancyAction: 'REPLACE', adrAction: 'REPLACE', lockedOrScored: true })

    expect((await confirmActuals(request('http://localhost/api/admin/actuals/import/confirm', csv, { fileHash: preview.fileHash, overrides: [{ rowNumber: 2, occupancy: 73 }] }))).status).toBe(422)
    expect((await confirmActuals(request('http://localhost/api/admin/actuals/import/confirm', csv, { fileHash: preview.fileHash, overrides: [{ rowNumber: 2, occupancy: 73 }], reason: 'Corrected verified hotel results' }))).status).toBe(200)

    const values = await prisma.actual.findMany({ where: { seasonId: season.id }, orderBy: { metric: 'asc' } })
    expect(values.map((actual) => actual.value).sort((a, b) => a - b)).toEqual([73, 210])
    expect(await prisma.actualValueRevision.count({ where: { action: 'EDIT', reason: 'Corrected verified hotel results' } })).toBe(2)
    expect(await prisma.round.findUnique({ where: { id: rounds[0].id } })).toMatchObject({ scoresStale: true, actualsVersion: initialActualsVersion + 1 })
  })
})
