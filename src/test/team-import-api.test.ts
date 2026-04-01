import { beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from './db'
import { loginAs } from './auth'
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

  it('preview validates rows without writing teams', async () => {
    await loginAs(admin.id)

    const csv = buildCsv([
      ['universityName', 'teamExternalId', 'teamName', 'supervisorEmail', 'submitterEmail', 'member1Email'],
      ['API Import University', 'api-001', 'Preview Team', 'supervisor@team-import-api.test', 'submitter@team-import-api.test', 'teammate@team-import-api.test'],
      ['API Import University', 'api-002', 'Invalid Team', 'supervisor@team-import-api.test', 'assigned@team-import-api.test', 'teammate@team-import-api.test'],
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
      ['API Import University', 'api-302', 'Skipped Team', 'supervisor@team-import-api.test', 'assigned@team-import-api.test', 'teammate@team-import-api.test'],
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
    expect(data.rows.find((row: { teamExternalId: string }) => row.teamExternalId === 'api-302')?.reason).toContain('already assigned')

    const teamsRes = await getAdminTeams()
    const teamsData = await teamsRes.json()
    const importedTeam = teamsData.teams.find((team: { externalTeamId?: string | null }) => team.externalTeamId === 'api-301')

    expect(teamsRes.status).toBe(200)
    expect(importedTeam).toBeTruthy()
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
