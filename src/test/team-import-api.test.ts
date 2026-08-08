import { beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import {
  addTeamMember,
  createSeasonWithRounds,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'
import { GET as getAdminTeams } from '@/app/api/admin/teams/route'
import { POST as previewTeamImport } from '@/app/api/admin/teams/import/preview/route'
import { POST as confirmTeamImport } from '@/app/api/admin/teams/import/confirm/route'
import { GET as downloadTeamImportTemplate } from '@/app/api/admin/teams/import/template/route'
import { buildRosterTemplate } from '@/lib/team-import/template'
import { parseTeamImportFile } from '@/lib/team-import/parser'

function makeFormRequest(url: string, formData: FormData) {
  return new NextRequest(url, {
    method: 'POST',
    body: formData,
  })
}

function buildCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        })
        .join(',')
    )
    .join('\n')
}

function makeImportFormData(seasonId: string, fileName: string, csv: string) {
  const formData = new FormData()
  formData.append('seasonId', seasonId)
  formData.append('file', new Blob([csv], { type: 'text/csv' }), fileName)
  return formData
}

function makeGuidedImportFormData(args: { seasonId: string; universityId: string; supervisorId: string; file: Buffer; batchId?: string; fileHash?: string }) {
  const formData = new FormData()
  formData.append('seasonId', args.seasonId)
  formData.append('universityId', args.universityId)
  formData.append('supervisorId', args.supervisorId)
  formData.append('file', new Blob([new Uint8Array(args.file)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'guided-roster.xlsx')
  formData.append('overrides', '[]')
  formData.append('excludedRowNumbers', '[]')
  if (args.batchId) formData.append('batchId', args.batchId)
  if (args.fileHash) formData.append('fileHash', args.fileHash)
  return formData
}

describe('team import API', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let admin: Awaited<ReturnType<typeof createUser>>
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let submitter: Awaited<ReturnType<typeof createUser>>
  let teammate: Awaited<ReturnType<typeof createUser>>
  let assignedStudent: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    university = await createUniversity('API Import University')
    season = (await createSeasonWithRounds()).season
    admin = await createUser({
      email: 'admin@team-import-api.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    supervisor = await createUser({
      email: 'supervisor@team-import-api.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    submitter = await createUser({
      email: 'submitter@team-import-api.test',
      role: 'STUDENT',
      firstName: 'Jacob',
      lastName: 'Perreault',
      universityId: university.id,
    })
    teammate = await createUser({
      email: 'teammate@team-import-api.test',
      role: 'STUDENT',
      firstName: 'Mona',
      lastName: 'Member',
      universityId: university.id,
    })
    assignedStudent = await createUser({
      email: 'assigned@team-import-api.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const existingTeam = await createTeam({
      name: 'Assigned Team',
      displayId: 'T-ASSIGNED',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(existingTeam.id, assignedStudent.id, true)
  })

  it('downloads a canonical guided template that its own parser can read', async () => {
    await loginAs(admin.id)
    const response = await downloadTeamImportTemplate(new Request(`http://localhost/api/admin/teams/import/template?seasonId=${season.id}&universityId=${university.id}&supervisorId=${supervisor.id}`))
    const workbook = Buffer.from(await response.arrayBuffer())
    const parsed = await parseTeamImportFile({ fileName: 'downloaded-template.xlsx', fileBuffer: workbook })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('spreadsheetml.sheet')
    expect(parsed.metadata).toMatchObject({ universityName: university.name, instructorEmail: supervisor.email })
    expect(parsed.rows).toHaveLength(10)
    expect(parsed.rows[0].rowNumber).toBe(9)
  })

  it('round-trips a populated guided workbook through preview and confirmation with bound context', async () => {
    await loginAs(admin.id)
    const workbook = buildRosterTemplate({
      mode: 'admin',
      seasonId: season.id,
      seasonName: season.name,
      universityId: university.id,
      universityName: university.name,
      supervisorId: supervisor.id,
      instructorName: `${supervisor.firstName} ${supervisor.lastName}`,
      instructorEmail: supervisor.email,
      initialRows: [{
        teamExternalId: 'GUIDED-001',
        teamName: 'Guided Team',
        people: [
          { firstName: submitter.firstName, lastName: submitter.lastName, email: submitter.email },
          { firstName: teammate.firstName, lastName: teammate.lastName, email: teammate.email },
        ],
      }],
    })
    const context = { seasonId: season.id, universityId: university.id, supervisorId: supervisor.id, file: workbook }
    const previewResponse = await previewTeamImport(makeFormRequest('http://localhost/api/admin/teams/import/preview', makeGuidedImportFormData(context)))
    const preview = await previewResponse.json()

    expect(previewResponse.status).toBe(200)
    expect(preview.templateVersion).toBe('2026.2')
    expect(preview.trustedContext).toEqual({ universityId: university.id, supervisorId: supervisor.id })
    expect(preview.summary.validRows).toBe(1)

    const confirmResponse = await confirmTeamImport(makeFormRequest('http://localhost/api/admin/teams/import/confirm', makeGuidedImportFormData({ ...context, batchId: preview.batchId, fileHash: preview.fileHash })))
    const result = await confirmResponse.json()
    expect(confirmResponse.status, JSON.stringify(result)).toBe(200)
    expect(result.summary.teamsCreated).toBe(1)
    await expect(prisma.team.findFirstOrThrow({ where: { externalTeamId: 'GUIDED-001' } })).resolves.toMatchObject({ status: 'ACTIVE', universityId: university.id, supervisorId: supervisor.id })
  })

  it('rejects a guided workbook when visible university metadata is changed', async () => {
    await loginAs(admin.id)
    const wrongUniversity = await createUniversity('Wrong Context University')
    const workbook = buildRosterTemplate({
      mode: 'admin', seasonId: season.id, seasonName: season.name,
      universityId: wrongUniversity.id, universityName: wrongUniversity.name,
      supervisorId: supervisor.id, instructorName: `${supervisor.firstName} ${supervisor.lastName}`, instructorEmail: supervisor.email,
      initialRows: [{ teamExternalId: 'WRONG-001', people: [{ firstName: submitter.firstName, lastName: submitter.lastName, email: submitter.email }] }],
    })
    const response = await previewTeamImport(makeFormRequest('http://localhost/api/admin/teams/import/preview', makeGuidedImportFormData({ seasonId: season.id, universityId: university.id, supervisorId: supervisor.id, file: workbook })))
    const data = await response.json()
    expect(response.status).toBe(409)
    expect(data.details.importDiagnostics[0].code).toBe('METADATA_CONTEXT_MISMATCH')
  })

  it('preview validates rows without writing teams', async () => {
    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail', 'member1Email'],
      ['API Import University', 'api-001', 'Preview Team', 'supervisor@team-import-api.test', 'submitter@team-import-api.test', 'teammate@team-import-api.test'],
      ['API Import University', 'api-002', 'Invalid Team', 'supervisor@team-import-api.test', 'assigned@team-import-api.test', 'invalid-row-member@team-import-api.test'],
    ])

    const res = await previewTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/preview',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary.validRows).toBe(1)
    expect(data.summary.invalidRows).toBe(1)
    expect(data.summary.rowsWithWarnings).toBe(0)
    expect(data.rows[0].submitter.email).toBe('submitter@team-import-api.test')
    expect(data.rows[0].submitter.nameMismatch).toBe(false)
    expect(data.rows[0].members).toHaveLength(1)
    expect(await prisma.team.count()).toBe(1)
  })

  it('preview rejects duplicate team names only within the selected season', async () => {
    await createTeam({
      name: 'I7',
      displayId: 'T-I7-CURRENT',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    const priorSeason = (await createSeasonWithRounds({ name: 'Historical Import Name Season' })).season
    await prisma.season.update({
      where: { id: priorSeason.id },
      data: { status: 'COMPLETED' },
    })
    await createTeam({
      name: 'Legacy Team',
      displayId: 'T-LEGACY-NAME',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: priorSeason.id,
      status: 'ACTIVE',
    })

    const historicalSubmitter = await createUser({
      email: 'historical-name@team-import-api.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail'],
      ['API Import University', 'api-name-001', 'I7', 'supervisor@team-import-api.test', 'submitter@team-import-api.test'],
      ['API Import University', 'api-name-002', 'Legacy Team', 'supervisor@team-import-api.test', historicalSubmitter.email],
    ])

    const res = await previewTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/preview',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary.validRows).toBe(1)
    expect(data.summary.invalidRows).toBe(1)
    expect(data.rows[0].errors.join(' ')).toContain('already exists in this season')
    expect(data.rows[1].errors).toEqual([])
  })

  it('confirm creates teams and members with approval metadata', async () => {
    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail', 'member1Email'],
      ['API Import University', 'api-101', '', 'supervisor@team-import-api.test', 'submitter@team-import-api.test', 'teammate@team-import-api.test'],
    ])

    const res = await confirmTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/confirm',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary.teamsCreated).toBe(1)
    expect(data.rows[0].submitter.nameMismatch).toBe(false)
    expect(data.rows[0].warnings).toEqual([])

    const importedTeam = await prisma.team.findFirst({
      where: { externalTeamId: 'api-101' },
      include: {
        members: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    expect(importedTeam).not.toBeNull()
    expect(importedTeam?.name).toBe('api-101')
    expect(importedTeam?.status).toBe('ACTIVE')
    expect(importedTeam?.approvedById).toBe(admin.id)
    expect(importedTeam?.approvedAt).not.toBeNull()
    expect(importedTeam?.members).toHaveLength(2)
    expect(importedTeam?.members.filter((member) => member.isSubmitter)).toHaveLength(1)
    expect(importedTeam?.members.find((member) => member.userId === submitter.id)?.isSubmitter).toBe(true)
  })

  it('confirm returns 422 and writes nothing when every row is invalid', async () => {
    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail'],
      ['API Import University', 'api-201', '', 'supervisor@team-import-api.test', 'assigned@team-import-api.test'],
    ])

    const res = await confirmTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/confirm',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toContain('No valid rows')
    expect(data.details.summary.validRows).toBe(0)
    expect(await prisma.team.count()).toBe(1)
  })

  it('confirm reports skipped rows and additive externalTeamId is exposed by admin teams API', async () => {
    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail', 'member1Email'],
      ['API Import University', 'api-301', 'Created Team', 'supervisor@team-import-api.test', 'submitter@team-import-api.test', 'teammate@team-import-api.test'],
      ['API Import University', 'api-302', 'Skipped Team', 'supervisor@team-import-api.test', 'assigned@team-import-api.test', 'skipped-row-member@team-import-api.test'],
    ])

    const res = await confirmTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/confirm',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary.teamsCreated).toBe(1)
    expect(data.summary.skippedRows).toBe(1)
    expect(data.rows.find((row: { teamExternalId: string }) => row.teamExternalId === 'api-302')?.reason).toContain('selected season')

    const teamsRes = await getAdminTeams(makeRequest('http://localhost/api/admin/teams'))
    const teamsData = await teamsRes.json()
    const importedTeam = teamsData.teams.find((team: { externalTeamId?: string | null }) => team.externalTeamId === 'api-301')

    expect(teamsRes.status).toBe(200)
    expect(importedTeam).toBeTruthy()
  })

  it('confirm allows students who only belong to teams in previous seasons', async () => {
    const priorSeason = (await createSeasonWithRounds({ name: 'Previous API Import Season' })).season
    await prisma.season.update({
      where: { id: priorSeason.id },
      data: { status: 'COMPLETED' },
    })

    const priorSeasonStudent = await createUser({
      email: 'previous-season-student@team-import-api.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const priorSeasonTeam = await createTeam({
      name: 'Previous Season Assignment',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: priorSeason.id,
      status: 'ACTIVE',
    })
    await addTeamMember(priorSeasonTeam.id, priorSeasonStudent.id, true)

    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail'],
      ['API Import University', 'api-351', 'Reused Student Team', 'supervisor@team-import-api.test', 'previous-season-student@team-import-api.test'],
    ])

    const res = await confirmTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/confirm',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary.teamsCreated).toBe(1)

    const memberships = await prisma.teamMember.findMany({
      where: { userId: priorSeasonStudent.id },
    })
    expect(memberships).toHaveLength(2)
  })

  it('confirm allows team names reused from previous seasons but skips same-season duplicates', async () => {
    const priorSeason = (await createSeasonWithRounds({ name: 'Previous Import Team Name Season' })).season
    await prisma.season.update({
      where: { id: priorSeason.id },
      data: { status: 'COMPLETED' },
    })

    await createTeam({
      name: 'I7',
      displayId: 'T-I7-HIST',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: priorSeason.id,
      status: 'ACTIVE',
    })
    await createTeam({
      name: 'Fire',
      displayId: 'T-FIRE-CURRENT',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    const historicalNameStudent = await createUser({
      email: 'historical-team-name@team-import-api.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const duplicateNameStudent = await createUser({
      email: 'duplicate-team-name@team-import-api.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail'],
      ['API Import University', 'api-352', 'I7', 'supervisor@team-import-api.test', historicalNameStudent.email],
      ['API Import University', 'api-353', 'Fire', 'supervisor@team-import-api.test', duplicateNameStudent.email],
    ])

    const res = await confirmTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/confirm',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.summary.teamsCreated).toBe(1)
    expect(data.summary.skippedRows).toBe(1)
    expect(data.rows.find((row: { teamExternalId: string }) => row.teamExternalId === 'api-352')?.status).toBe('created')
    expect(
      data.rows.find((row: { teamExternalId: string }) => row.teamExternalId === 'api-353')?.reason
    ).toContain('already exists in this season')
  })

  it('keeps email as the identity key and returns advisory name mismatch warnings', async () => {
    await loginAs(admin.id)

    const csv = buildCsv([
      [
        'universityName',
        'teamExternalId',
        'teamName',
        'supervisorEmail',
        'submitterEmail',
        'submitterFirstName',
        'submitterLastName',
        'member1Email',
        'member1FirstName',
        'member1LastName',
      ],
      [
        'API Import University',
        'api-401',
        'Warning Team',
        'supervisor@team-import-api.test',
        'submitter@team-import-api.test',
        'Jake',
        'Perreault',
        'teammate@team-import-api.test',
        'Mona',
        'Member',
      ],
    ])

    const previewRes = await previewTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/preview',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const previewData = await previewRes.json()

    expect(previewRes.status).toBe(200)
    expect(previewData.summary.validRows).toBe(1)
    expect(previewData.summary.rowsWithWarnings).toBe(1)
    expect(previewData.rows[0].warningCount).toBe(1)
    expect(previewData.rows[0].warnings[0]).toContain('uploaded "Jake Perreault"')
    expect(previewData.rows[0].warnings[0]).toContain('matched system user "Jacob Perreault"')
    expect(previewData.rows[0].submitter.uploadedName).toBe('Jake Perreault')
    expect(previewData.rows[0].submitter.matchedName).toBe('Jacob Perreault')
    expect(previewData.rows[0].submitter.nameMismatch).toBe(true)

    const confirmRes = await confirmTeamImport(
      makeFormRequest(
        'http://localhost/api/admin/teams/import/confirm',
        makeImportFormData(season.id, 'teams.csv', csv)
      )
    )
    const confirmData = await confirmRes.json()

    expect(confirmRes.status).toBe(200)
    expect(confirmData.summary.teamsCreated).toBe(1)
    expect(confirmData.summary.rowsWithWarnings).toBe(1)
    expect(confirmData.rows[0].status).toBe('created')
    expect(confirmData.rows[0].warningCount).toBe(1)
    expect(confirmData.rows[0].submitter.uploadedName).toBe('Jake Perreault')
    expect(confirmData.rows[0].submitter.matchedName).toBe('Jacob Perreault')
    expect(confirmData.rows[0].members[0].nameMismatch).toBe(false)
  })
})
