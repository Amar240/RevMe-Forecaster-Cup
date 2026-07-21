import { readFile } from 'fs/promises'
import { beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from './db'
import { loginAs } from './auth'
import { createSeasonWithRounds, createUniversity, createUser } from './fixtures'
import { POST as previewImport } from '@/app/api/supervisor/roster-import/preview/route'
import { POST as confirmImport } from '@/app/api/supervisor/roster-import/confirm/route'
import { GET as getHistory } from '@/app/api/supervisor/roster-import/route'
import { POST as withdrawTeam } from '@/app/api/supervisor/roster-import/teams/[teamId]/withdraw/route'

function request(url: string, file: Buffer, options: { batchId?: string; fileHash?: string; overrides?: unknown[]; excludedRowNumbers?: number[] } = {}) {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(file)]), 'registration-vinuni-sample.xlsx')
  if (options.batchId) form.append('batchId', options.batchId)
  if (options.fileHash) form.append('fileHash', options.fileHash)
  form.append('overrides', JSON.stringify(options.overrides ?? []))
  form.append('excludedRowNumbers', JSON.stringify(options.excludedRowNumbers ?? []))
  return new NextRequest(url, { method: 'POST', body: form })
}

describe('supervisor roster import API', () => {
  let file: Buffer
  let supervisor: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    file = await readFile('src/test/fixtures/registration-vinuni-sample.xlsx')
    const university = await createUniversity('VinUniversity')
    await createSeasonWithRounds({ name: 'Roster Season' })
    supervisor = await createUser({ email: 'supervisor@vinuni.edu.vn', role: 'SUPERVISOR', firstName: 'Eric', lastName: 'Olson', universityId: university.id })
    await loginAs(supervisor.id)
  })

  it('previews the real workbook and stores an uploader-scoped PREVIEWED batch', async () => {
    const response = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.summary).toMatchObject({ totalRows: 6, validRows: 6, invalidRows: 0 })
    expect(data.fileWarnings.join(' ')).toContain('differs from uploader')
    expect(data.rows[2].submitter.provenance).toBe('Row 11 · Corresponding Team Member')
    expect(await prisma.importBatch.findUnique({ where: { id: data.batchId } })).toMatchObject({ uploaderId: supervisor.id, status: 'PREVIEWED', uploaderRole: 'SUPERVISOR' })
  })

  it('confirms all valid rows atomically as pending and is idempotent', async () => {
    const previewResponse = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))
    const preview = await previewResponse.json()
    const firstResponse = await confirmImport(request('http://localhost/api/supervisor/roster-import/confirm', file, { batchId: preview.batchId, fileHash: preview.fileHash }))
    const first = await firstResponse.json()
    expect(firstResponse.status).toBe(200)
    expect(first.summary).toMatchObject({ teamsCreated: 6, skippedRows: 0 })
    expect(await prisma.team.count({ where: { importBatchId: preview.batchId, status: 'PENDING_APPROVAL' } })).toBe(6)
    expect(await prisma.user.count({ where: { role: 'STUDENT', resetToken: { not: null } } })).toBe(0)

    const secondResponse = await confirmImport(request('http://localhost/api/supervisor/roster-import/confirm', file, { batchId: preview.batchId, fileHash: preview.fileHash }))
    expect(secondResponse.status).toBe(200)
    expect(await prisma.team.count({ where: { importBatchId: preview.batchId } })).toBe(6)
    expect(await prisma.importBatch.findUnique({ where: { id: preview.batchId } })).toMatchObject({ status: 'CONFIRMED' })
  })

  it('rejects a changed workbook and isolates batch history by uploader', async () => {
    const previewResponse = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))
    const preview = await previewResponse.json()
    const changed = Buffer.concat([file, Buffer.from('changed')])
    const confirmResponse = await confirmImport(request('http://localhost/api/supervisor/roster-import/confirm', changed, { batchId: preview.batchId, fileHash: preview.fileHash }))
    expect(confirmResponse.status).toBe(409)

    const other = await createUser({ email: 'other-supervisor@vinuni.edu.vn', role: 'SUPERVISOR', universityId: supervisor.universityId })
    await loginAs(other.id)
    const historyResponse = await getHistory()
    const history = await historyResponse.json()
    expect(historyResponse.status).toBe(200)
    expect(history.batches).toEqual([])
  })

  it('re-checks the same batch, persists normalized overrides, and rejects stale originals', async () => {
    const initialResponse = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))
    const initial = await initialResponse.json()
    const original = initial.rows[0].submitter.email
    const overrides = [{ rowNumber: initial.rows[0].rowNumber, columnLabel: 'Corresponding Team Member', field: 'email', original, value: '  RECHECKED@VINUNI.EDU.VN\t' }]
    const checkedResponse = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file, { batchId: initial.batchId, fileHash: initial.fileHash, overrides }))
    const checked = await checkedResponse.json()

    expect(checkedResponse.status).toBe(200)
    expect(checked.batchId).toBe(initial.batchId)
    expect(checked.rows[0].submitter.email).toBe('rechecked@vinuni.edu.vn')
    expect(checked.overrides[0]).toMatchObject({ original, value: 'RECHECKED@VINUNI.EDU.VN' })
    expect(await prisma.importBatch.count({ where: { uploaderId: supervisor.id } })).toBe(1)
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: initial.batchId } })).summaryJson).toMatchObject({ overrides: [expect.objectContaining({ original })] })

    const staleResponse = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file, {
      batchId: initial.batchId,
      fileHash: initial.fileHash,
      overrides: [{ ...overrides[0], original: 'stale@vinuni.edu.vn' }],
    }))
    expect(staleResponse.status).toBe(409)
  })

  it('rejects malformed override JSON and a stale explicit hash', async () => {
    const malformed = new FormData()
    malformed.append('file', new Blob([new Uint8Array(file)]), 'registration-vinuni-sample.xlsx')
    malformed.append('overrides', '{not-json')
    expect((await previewImport(new NextRequest('http://localhost/api/supervisor/roster-import/preview', { method: 'POST', body: malformed }))).status).toBe(400)

    const initial = await (await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))).json()
    const stale = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file, { batchId: initial.batchId, fileHash: '0'.repeat(64) }))
    expect(stale.status).toBe(409)
  })

  it('denies students and closed registration', async () => {
    const student = await createUser({ email: 'student@vinuni.edu.vn', role: 'STUDENT', universityId: supervisor.universityId })
    await loginAs(student.id)
    expect((await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))).status).toBe(403)
    await loginAs(supervisor.id)
    await prisma.season.updateMany({ data: { registrationOpen: false } })
    expect((await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))).status).toBe(422)
  })

  it('excludes rows before validation and confirms them as skipped', async () => {
    const initial = await (await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))).json()
    const removedRow = initial.rows[0].rowNumber
    const checkedResponse = await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file, { batchId: initial.batchId, fileHash: initial.fileHash, excludedRowNumbers: [removedRow] }))
    const checked = await checkedResponse.json()
    expect(checkedResponse.status).toBe(200)
    expect(checked.summary).toMatchObject({ totalRows: 6, validRows: 5, invalidRows: 0, excludedRows: 1 })
    expect(checked.rows.find((row: { rowNumber: number }) => row.rowNumber === removedRow)).toMatchObject({ excluded: true })

    const confirmedResponse = await confirmImport(request('http://localhost/api/supervisor/roster-import/confirm', file, { batchId: checked.batchId, fileHash: checked.fileHash, excludedRowNumbers: [removedRow] }))
    const confirmed = await confirmedResponse.json()
    expect(confirmedResponse.status).toBe(200)
    expect(confirmed.summary).toMatchObject({ teamsCreated: 5, skippedRows: 1, excludedRows: 1 })
    expect(confirmed.rows.find((row: { rowNumber: number }) => row.rowNumber === removedRow)).toMatchObject({ status: 'skipped', reason: 'Removed from import by supervisor' })
  })

  it('withdraws only a pending team owned by the importing supervisor', async () => {
    const preview = await (await previewImport(request('http://localhost/api/supervisor/roster-import/preview', file))).json()
    await confirmImport(request('http://localhost/api/supervisor/roster-import/confirm', file, { batchId: preview.batchId, fileHash: preview.fileHash }))
    const team = await prisma.team.findFirstOrThrow({ where: { importBatchId: preview.batchId } })
    await prisma.season.updateMany({ data: { registrationOpen: false } })
    const response = await withdrawTeam(new NextRequest(`http://localhost/api/supervisor/roster-import/teams/${team.id}/withdraw`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Wrong roster row' }) }), { params: { teamId: team.id } })
    expect(response.status).toBe(200)
    expect(await prisma.team.findUniqueOrThrow({ where: { id: team.id } })).toMatchObject({ status: 'REJECTED', rejectionReason: 'Withdrawn by supervisor: Wrong roster row' })
    expect(await prisma.teamMember.count({ where: { teamId: team.id } })).toBeGreaterThan(0)
    expect(await prisma.auditLog.findFirst({ where: { entityId: team.id, action: 'IMPORTED_TEAM_WITHDRAWN' } })).toBeTruthy()
  })
})
