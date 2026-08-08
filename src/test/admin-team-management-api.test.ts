import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db'
import {
  addTeamMember,
  createSeasonWithRounds,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'
import { loginAs } from './auth'
import { makeRequest } from './http'
import { GET as getAdminTeams, POST as postAdminTeams } from '@/app/api/admin/teams/route'
import { PATCH as patchAdminTeam } from '@/app/api/admin/teams/[id]/route'
import { PATCH as patchAdminTeamStatus } from '@/app/api/admin/teams/[id]/status/route'

describe('Admin team management APIs', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let secondUniversity: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let secondSeason: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let admin: Awaited<ReturnType<typeof createUser>>
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let secondSupervisor: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    university = await createUniversity('Manual Team University')
    secondUniversity = await createUniversity('Other Manual Team University')
    season = (await createSeasonWithRounds({ name: 'Manual Team Season' })).season
    secondSeason = (await createSeasonWithRounds({ name: 'Manual Team Season 2' })).season
    admin = await createUser({
      email: 'admin@manual-teams.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    supervisor = await createUser({
      email: 'supervisor@manual-teams.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    secondSupervisor = await createUser({
      email: 'second-supervisor@manual-teams.test',
      role: 'SUPERVISOR',
      universityId: secondUniversity.id,
    })
  })

  it('admin can create a draft team manually', async () => {
    await loginAs(admin.id)

    const req = makeRequest('http://localhost/api/admin/teams', {
      method: 'POST',
      body: {
        seasonId: season.id,
        universityId: university.id,
        name: 'Manual Team',
        externalTeamId: 'MAN-001',
        supervisorId: supervisor.id,
      },
    })
    const res = await postAdminTeams(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.team.name).toBe('Manual Team')
    expect(data.team.status).toBe('DRAFT')
    expect(data.team.externalTeamId).toBe('MAN-001')

    const created = await prisma.team.findUnique({ where: { id: data.team.id } })
    expect(created?.seasonId).toBe(season.id)
    expect(created?.universityId).toBe(university.id)
    expect(created?.supervisorId).toBe(supervisor.id)
    const assignment = await prisma.teamSupervisorAssignment.findFirst({
      where: { teamId: data.team.id, endedAt: null },
    })
    expect(assignment?.supervisorId).toBe(supervisor.id)
    expect(assignment?.source).toBe('INITIAL')
  })

  it('manual create allows reusing a team name from a different season', async () => {
    await createTeam({
      name: 'Revenue Runners',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest('http://localhost/api/admin/teams', {
      method: 'POST',
      body: {
        seasonId: secondSeason.id,
        universityId: university.id,
        name: 'revenue runners',
        supervisorId: supervisor.id,
      },
    })
    const res = await postAdminTeams(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.team.name).toBe('revenue runners')
    expect(data.team.seasonId).toBe(secondSeason.id)
  })

  it('manual create rejects duplicate team names case-insensitively in the same season', async () => {
    await createTeam({
      name: 'Revenue Runners',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest('http://localhost/api/admin/teams', {
      method: 'POST',
      body: {
        seasonId: season.id,
        universityId: university.id,
        name: 'revenue runners',
        supervisorId: supervisor.id,
      },
    })
    const res = await postAdminTeams(req)
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toContain('already exists in this season')
  })

  it('manual create rejects duplicate external team IDs in the same season', async () => {
    await createTeam({
      name: 'Existing Import Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      externalTeamId: 'EXT-1',
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest('http://localhost/api/admin/teams', {
      method: 'POST',
      body: {
        seasonId: season.id,
        universityId: university.id,
        name: 'Second Import Team',
        externalTeamId: 'EXT-1',
        supervisorId: supervisor.id,
      },
    })
    const res = await postAdminTeams(req)

    expect(res.status).toBe(422)
  })

  it('manual create rejects supervisors from another university', async () => {
    await loginAs(admin.id)

    const req = makeRequest('http://localhost/api/admin/teams', {
      method: 'POST',
      body: {
        seasonId: season.id,
        universityId: university.id,
        name: 'Cross University Team',
        supervisorId: secondSupervisor.id,
      },
    })
    const res = await postAdminTeams(req)

    expect(res.status).toBe(422)
  })

  it('manual create ignores a supervisor cap reached only in previous seasons', async () => {
    const historicalSeason = (await createSeasonWithRounds({ name: 'Historical Admin Cap Season' })).season
    await prisma.season.update({
      where: { id: historicalSeason.id },
      data: { status: 'COMPLETED' },
    })

    for (let index = 0; index < 10; index += 1) {
      await createTeam({
        name: `Historical Admin Team ${index}`,
        supervisorId: supervisor.id,
        universityId: university.id,
        seasonId: historicalSeason.id,
        status: 'ACTIVE',
      })
    }

    await loginAs(admin.id)
    const req = makeRequest('http://localhost/api/admin/teams', {
      method: 'POST',
      body: {
        seasonId: season.id,
        universityId: university.id,
        name: 'Current Manual Team',
        supervisorId: supervisor.id,
      },
    })
    const res = await postAdminTeams(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.team.seasonId).toBe(season.id)
  })

  it('admin can edit team metadata safely', async () => {
    const team = await createTeam({
      name: 'Editable Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      externalTeamId: 'EDIT-OLD',
      status: 'DRAFT',
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}`, {
      method: 'PATCH',
      body: {
        name: 'Edited Team',
        externalTeamId: 'EDIT-NEW',
      },
    })
    const res = await patchAdminTeam(req, { params: Promise.resolve({ id: team.id }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.team.name).toBe('Edited Team')
    expect(data.team.externalTeamId).toBe('EDIT-NEW')

    const updated = await prisma.team.findUnique({ where: { id: team.id } })
    expect(updated?.seasonId).toBe(season.id)
    expect(updated?.universityId).toBe(university.id)
  })

  it('admin rename allows a team name that exists only in another season', async () => {
    await createTeam({
      name: 'Historic Name',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: secondSeason.id,
      status: 'ACTIVE',
    })

    const team = await createTeam({
      name: 'Current Name',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'DRAFT',
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}`, {
      method: 'PATCH',
      body: {
        name: 'Historic Name',
      },
    })
    const res = await patchAdminTeam(req, { params: Promise.resolve({ id: team.id }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.team.name).toBe('Historic Name')
  })

  it('admin rename rejects a duplicate team name in the same season', async () => {
    await createTeam({
      name: 'Existing Current Name',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    const team = await createTeam({
      name: 'Rename Target',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'DRAFT',
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}`, {
      method: 'PATCH',
      body: {
        name: 'existing current name',
      },
    })
    const res = await patchAdminTeam(req, { params: Promise.resolve({ id: team.id }) })
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toContain('already exists in this season')
  })

  it('archive and restore to draft preserve team history safely', async () => {
    const team = await createTeam({
      name: 'Archive Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const archiveReq = makeRequest(`http://localhost/api/admin/teams/${team.id}/status`, {
      method: 'PATCH',
      body: { action: 'archive' },
    })
    const archiveRes = await patchAdminTeamStatus(archiveReq, { params: Promise.resolve({ id: team.id }) })
    const archivedData = await archiveRes.json()

    expect(archiveRes.status).toBe(200)
    expect(archivedData.team.status).toBe('ARCHIVED')

    const restoreReq = makeRequest(`http://localhost/api/admin/teams/${team.id}/status`, {
      method: 'PATCH',
      body: { action: 'restore-draft' },
    })
    const restoreRes = await patchAdminTeamStatus(restoreReq, { params: Promise.resolve({ id: team.id }) })
    const restoredData = await restoreRes.json()

    expect(restoreRes.status).toBe(200)
    expect(restoredData.team.status).toBe('DRAFT')
  })

  it('draft activation requires a roster and submitter before succeeding', async () => {
    const team = await createTeam({
      name: 'Activation Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'DRAFT',
    })

    await loginAs(admin.id)
    const firstAttemptReq = makeRequest(`http://localhost/api/admin/teams/${team.id}/status`, {
      method: 'PATCH',
      body: { action: 'activate' },
    })
    const firstAttemptRes = await patchAdminTeamStatus(firstAttemptReq, { params: Promise.resolve({ id: team.id }) })

    expect(firstAttemptRes.status).toBe(422)

    const student = await createUser({
      email: 'activation-student@manual-teams.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    await addTeamMember(team.id, student.id, true)

    const secondAttemptReq = makeRequest(`http://localhost/api/admin/teams/${team.id}/status`, {
      method: 'PATCH',
      body: { action: 'activate' },
    })
    const secondAttemptRes = await patchAdminTeamStatus(secondAttemptReq, { params: Promise.resolve({ id: team.id }) })
    const data = await secondAttemptRes.json()

    expect(secondAttemptRes.status).toBe(200)
    expect(data.team.status).toBe('ACTIVE')

    const activated = await prisma.team.findUnique({ where: { id: team.id } })
    expect(activated?.approvedById).toBe(admin.id)
    expect(activated?.approvedAt).not.toBeNull()
  })

  it('admin teams list still returns archived teams after cleanup', async () => {
    const team = await createTeam({
      name: 'List Archive Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await prisma.team.update({
      where: { id: team.id },
      data: { status: 'ARCHIVED' },
    })

    await loginAs(admin.id)
    const res = await getAdminTeams(makeRequest(`http://localhost/api/admin/teams?seasonId=${season.id}`))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.teams.some((entry: { id: string; status: string }) => entry.id === team.id && entry.status === 'ARCHIVED')).toBe(true)
  })
})
