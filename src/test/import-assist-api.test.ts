import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFile } from 'fs/promises'
import { prisma } from './db'
import { loginAs } from './auth'
import { createSeasonWithRounds, createUniversity, createUser } from './fixtures'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@/server/import-assist', async (original) => {
  const actual = await original<typeof import('@/server/import-assist')>()
  return { ...actual, isImportAssistEnabled: () => process.env.BEDROCK_IMPORT_ASSIST === 'true', invokeImportAssist: invoke }
})

import { POST as layoutAssist } from '@/app/api/supervisor/roster-import/assist/layout/route'
import { POST as outcomeAssist } from '@/app/api/supervisor/roster-import/assist/outcome/route'
import { POST as repairAssist } from '@/app/api/supervisor/roster-import/assist/repair/route'
import { POST as explainAssist } from '@/app/api/supervisor/roster-import/assist/explain/route'
import { POST as previewImport } from '@/app/api/supervisor/roster-import/preview/route'

function upload(content: string, options: { batchId?: string; fileHash?: string } = {}) {
  const form = new FormData()
  form.append('file', new Blob([content]), 'unmapped.csv')
  form.append('overrides', '[]')
  if (options.batchId) form.append('batchId', options.batchId)
  if (options.fileHash) form.append('fileHash', options.fileHash)
  return new NextRequest('http://localhost/api/supervisor/roster-import/assist/layout', { method: 'POST', body: form })
}

describe('import assist API', () => {
  beforeEach(async () => {
    vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'true')
    invoke.mockReset()
    const university = await createUniversity('Assist University')
    const { season } = await createSeasonWithRounds({ name: 'Assist Season' })
    await prisma.season.update({ where: { id: season.id }, data: { importAssistMode: 'ON_DEMAND' } })
    const supervisor = await createUser({ email: 'assist-supervisor@example.edu', role: 'SUPERVISOR', universityId: university.id })
    await loginAs(supervisor.id)
  })

  it('returns 404 while disabled without invoking the model', async () => {
    vi.stubEnv('BEDROCK_IMPORT_ASSIST', 'false')
    expect((await layoutAssist(upload('Odd A,Odd B\nvalue,value'))).status).toBe(404)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('sends at most ten rows, creates one preview batch, and audits decisions', async () => {
    const mapping = { headerRowIndex: 0, columnMap: [
      { column: 0, field: 'universityName', confidence: 0.9 }, { column: 1, field: 'teamExternalId', confidence: 0.9 },
      { column: 2, field: 'submitter.firstName', confidence: 0.9 }, { column: 3, field: 'submitter.lastName', confidence: 0.9 },
      { column: 4, field: 'submitter.email', confidence: 0.9 }, { column: 5, field: 'teamName', confidence: 0.8 },
    ] }
    invoke.mockResolvedValue({ data: mapping, modelId: 'test-model', inputTokens: 10, outputTokens: 5, latencyMs: 12 })
    const csv = ['Odd A,Odd B,Odd C,Odd D,Odd E,Odd F', ...Array.from({ length: 15 }, (_, index) => `U${index},T${index},A,B,a${index}@u.edu,N`)].join('\n')
    const response = await layoutAssist(upload(csv)); const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.available).toBe(true)
    expect(invoke.mock.calls[0][0].input.rows).toHaveLength(10)
    expect(await prisma.importBatch.count()).toBe(1)

    const outcome = await outcomeAssist(new NextRequest('http://localhost/api/supervisor/roster-import/assist/outcome', { method: 'POST', body: JSON.stringify({ batchId: data.batchId, suggestionId: data.suggestion.id, outcome: 'ACCEPTED' }), headers: { 'Content-Type': 'application/json' } }))
    expect(outcome.status).toBe(200)
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: data.batchId } })).summaryJson).toMatchObject({ assist: { suggestions: [expect.objectContaining({ id: data.suggestion.id, outcome: 'ACCEPTED' })] } })
  })

  it('denies students and rejects changed workbook bytes', async () => {
    const student = await createUser({ email: 'assist-student@example.edu', role: 'STUDENT' }); await loginAs(student.id)
    expect((await layoutAssist(upload('Odd A,Odd B\nvalue,value'))).status).toBe(403)
  })

  it('counts unavailable model attempts against the per-version layout limit', async () => {
    invoke.mockResolvedValue(null)
    const csv = 'Odd A,Odd B\nvalue,value'
    const first = await layoutAssist(upload(csv))
    const data = await first.json()
    expect(first.status).toBe(200)
    expect(data.available).toBe(false)
    const second = await layoutAssist(upload(csv, { batchId: data.batchId, fileHash: data.fileHash }))
    expect(second.status).toBe(429)
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('returns targeted repair suggestions and deterministic validation still rejects an invalid fix', async () => {
    const workbook = await readFile('src/test/fixtures/registration-vinuni-sample.xlsx')
    await prisma.university.updateMany({ data: { name: 'VinUniversity', normalizedName: 'vinuniversity' } })
    const initialForm = new FormData(); initialForm.append('file', new Blob([new Uint8Array(workbook)]), 'registration.xlsx'); initialForm.append('overrides', '[]')
    const previewResponse = await previewImport(new NextRequest('http://localhost/api/supervisor/roster-import/preview', { method: 'POST', body: initialForm }))
    const preview = await previewResponse.json()
    const affectedRow = preview.rows.find((row: { warnings: string[] }) => row.warnings.some((warning) => warning.includes('glued name')))
    const affectedPerson = [affectedRow.submitter, ...affectedRow.members].find((person: { provenance: string }) => affectedRow.warnings.some((warning: string) => warning.includes(person.provenance)))
    const columnLabel = affectedPerson.provenance.split(' · ')[1]
    invoke.mockResolvedValue({ data: { repairs: [{ rowNumber: affectedRow.rowNumber, columnLabel, field: 'email', suggestion: 'not-an-email', reason: 'AI test suggestion', confidence: 0.7 }] }, modelId: 'test-model', inputTokens: 8, outputTokens: 4, latencyMs: 10 })
    const repairForm = new FormData(); repairForm.append('file', new Blob([new Uint8Array(workbook)]), 'registration.xlsx'); repairForm.append('batchId', preview.batchId); repairForm.append('fileHash', preview.fileHash); repairForm.append('overrides', '[]')
    const repairResponse = await repairAssist(new NextRequest('http://localhost/api/supervisor/roster-import/assist/repair', { method: 'POST', body: repairForm })); const repair = await repairResponse.json()
    expect(repairResponse.status).toBe(200)
    expect(repair.suggestions).toHaveLength(1)
    expect(invoke.mock.calls.at(-1)?.[0].input.fields).toEqual([expect.objectContaining({ rowNumber: affectedRow.rowNumber, columnLabel })])
    const repeatedForm = new FormData(); repeatedForm.append('file', new Blob([new Uint8Array(workbook)]), 'registration.xlsx'); repeatedForm.append('batchId', preview.batchId); repeatedForm.append('fileHash', preview.fileHash); repeatedForm.append('overrides', '[]')
    const repeated = await (await repairAssist(new NextRequest('http://localhost/api/supervisor/roster-import/assist/repair', { method: 'POST', body: repeatedForm }))).json()
    expect(repeated.suggestions[0].id).toBe(repair.suggestions[0].id)
    expect(invoke).toHaveBeenCalledTimes(1)

    const accepted = repair.suggestions[0]
    await outcomeAssist(new NextRequest('http://localhost/api/supervisor/roster-import/assist/outcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId: preview.batchId, suggestionId: accepted.id, outcome: 'ACCEPTED' }) }))
    const overrideForm = new FormData(); overrideForm.append('file', new Blob([new Uint8Array(workbook)]), 'registration.xlsx'); overrideForm.append('batchId', preview.batchId); overrideForm.append('fileHash', preview.fileHash); overrideForm.append('overrides', JSON.stringify([{ rowNumber: affectedRow.rowNumber, columnLabel, field: 'email', original: affectedPerson.email, value: accepted.suggestion }]))
    const checked = await (await previewImport(new NextRequest('http://localhost/api/supervisor/roster-import/preview', { method: 'POST', body: overrideForm }))).json()
    expect(checked.rows.find((row: { rowNumber: number }) => row.rowNumber === affectedRow.rowNumber).valid).toBe(false)
    const staleOutcome = await outcomeAssist(new NextRequest('http://localhost/api/supervisor/roster-import/assist/outcome', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId: preview.batchId, suggestionId: accepted.id, outcome: 'REJECTED' }) }))
    expect(staleOutcome.status).toBe(409)
    expect((await prisma.importBatch.findUniqueOrThrow({ where: { id: preview.batchId } })).summaryJson).toMatchObject({ assist: { suggestions: [expect.objectContaining({ id: accepted.id, deterministicValidationFailed: true })] } })
    expect(await prisma.team.count()).toBe(0)
  })

  it('caches an explanation for unchanged deterministic diagnostics', async () => {
    const workbook = await readFile('src/test/fixtures/registration-vinuni-sample.xlsx')
    await prisma.university.updateMany({ data: { name: 'VinUniversity', normalizedName: 'vinuniversity' } })
    const previewForm = new FormData(); previewForm.append('file', new Blob([new Uint8Array(workbook)]), 'registration.xlsx'); previewForm.append('overrides', '[]')
    const preview = await (await previewImport(new NextRequest('http://localhost/api/supervisor/roster-import/preview', { method: 'POST', body: previewForm }))).json()
    invoke.mockResolvedValue({ data: { summary: 'Review the highlighted names.', nextSteps: ['Open each warning and verify the name split.'] }, modelId: 'test-model', inputTokens: 7, outputTokens: 3, latencyMs: 9 })
    const request = () => { const form = new FormData(); form.append('file', new Blob([new Uint8Array(workbook)]), 'registration.xlsx'); form.append('batchId', preview.batchId); form.append('fileHash', preview.fileHash); form.append('overrides', '[]'); return new NextRequest('http://localhost/api/supervisor/roster-import/assist/explain', { method: 'POST', body: form }) }
    const first = await explainAssist(request())
    const second = await explainAssist(request())
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ available: true, explanation: { summary: 'Review the highlighted names.' } })
    expect(invoke).toHaveBeenCalledTimes(1)
  })
})
