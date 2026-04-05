import { beforeEach, describe, expect, it } from 'vitest'
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
import {
  GET as getCopyFromSeasonOptions,
  POST as postCopyFromSeason,
} from '@/app/api/admin/teams/copy-from-season/route'

async function createCompletedSeason(params: {
  name: string
  startDate: Date
  endDate: Date
}) {
  return prisma.season.create({
    data: {
      name: params.name,
      status: 'COMPLETED',
      registrationOpen: false,
      startDate: params.startDate,
      endDate: params.endDate,
    },
  })
}

describe('team copy-from-season API', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let admin: Awaited<ReturnType<typeof createUser>>
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let student: Awaited<ReturnType<typeof createUser>>
  let targetSeason: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let olderCompletedSeason: Awaited<ReturnType<typeof createCompletedSeason>>
  let latestCompletedSeason: Awaited<ReturnType<typeof createCompletedSeason>>
  let latestSourceTeam: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await createUniversity('Copy Source University')
    admin = await createUser({
      email: 'admin@copy-from-season.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    supervisor = await createUser({
      email: 'supervisor@copy-from-season.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    student = await createUser({
      email: 'student@copy-from-season.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    targetSeason = (await createSeasonWithRounds({ name: 'Target Active Season' })).season
    olderCompletedSeason = await createCompletedSeason({
      name: 'Spring 2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-03-01T00:00:00.000Z'),
    })
    latestCompletedSeason = await createCompletedSeason({
      name: 'Summer 2026',
      startDate: new Date('2026-03-02T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
    })

    await createTeam({
      name: 'Older Completed Team',
      displayId: 'T-OLDER-COPY',
      externalTeamId: 'OLDER-1',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: olderCompletedSeason.id,
      status: 'ACTIVE',
    })

    latestSourceTeam = await createTeam({
      name: 'Latest Copy Team',
      displayId: 'T-LATEST-COPY',
      externalTeamId: 'COPY-1',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: latestCompletedSeason.id,
      status: 'ACTIVE',
    })
    await addTeamMember(latestSourceTeam.id, student.id, true)

    await createTeam({
      name: 'Duplicate External Team',
      displayId: 'T-LATEST-DUP',
      externalTeamId: 'COPY-DUP',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: latestCompletedSeason.id,
      status: 'ACTIVE',
    })

    await createTeam({
      name: 'Existing Target Team',
      displayId: 'T-TARGET-DUP',
      externalTeamId: 'COPY-DUP',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: targetSeason.id,
      status: 'ACTIVE',
    })

    await createCompletedSeason({
      name: 'Completed Without Teams',
      startDate: new Date('2025-09-01T00:00:00.000Z'),
      endDate: new Date('2025-12-01T00:00:00.000Z'),
    })

    await loginAs(admin.id)
  })

  it('GET returns completed seasons with copyable teams ordered newest first', async () => {
    const res = await getCopyFromSeasonOptions()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.seasons).toHaveLength(2)
    expect(data.seasons[0].id).toBe(latestCompletedSeason.id)
    expect(data.seasons[0].teamCount).toBe(2)
    expect(data.seasons[1].id).toBe(olderCompletedSeason.id)
    expect(data.seasons.map((season: { name: string }) => season.name)).not.toContain('Completed Without Teams')
  })

  it('POST copies only latest completed season teams into the target season and never copies members', async () => {
    const req = makeRequest('http://localhost/api/admin/teams/copy-from-season', {
      method: 'POST',
      body: {
        sourceSeasonId: latestCompletedSeason.id,
        targetSeasonId: targetSeason.id,
        copyMembers: false,
      },
    })

    const res = await postCopyFromSeason(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sourceSeasonName).toBe(latestCompletedSeason.name)
    expect(data.targetSeasonName).toBe(targetSeason.name)
    expect(data.teamsCreated).toBe(1)
    expect(data.teamsSkipped).toBe(1)
    expect(data.membersLinked).toBe(0)

    const copiedTeam = await prisma.team.findFirst({
      where: {
        seasonId: targetSeason.id,
        externalTeamId: 'COPY-1',
      },
      include: {
        members: true,
      },
    })

    expect(copiedTeam).not.toBeNull()
    expect(copiedTeam?.id).not.toBe(latestSourceTeam.id)
    expect(copiedTeam?.displayId).not.toBe(latestSourceTeam.displayId)
    expect(copiedTeam?.name).toBe(latestSourceTeam.name)
    expect(copiedTeam?.universityId).toBe(latestSourceTeam.universityId)
    expect(copiedTeam?.supervisorId).toBe(latestSourceTeam.supervisorId)
    expect(copiedTeam?.members).toHaveLength(0)
  })

  it('POST rejects copyMembers=true in the safe first version', async () => {
    const req = makeRequest('http://localhost/api/admin/teams/copy-from-season', {
      method: 'POST',
      body: {
        sourceSeasonId: latestCompletedSeason.id,
        targetSeasonId: targetSeason.id,
        copyMembers: true,
      },
    })

    const res = await postCopyFromSeason(req)
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toContain('Copying team members is unavailable')
  })

  it('POST rejects a non-latest completed source season', async () => {
    const req = makeRequest('http://localhost/api/admin/teams/copy-from-season', {
      method: 'POST',
      body: {
        sourceSeasonId: olderCompletedSeason.id,
        targetSeasonId: targetSeason.id,
        copyMembers: false,
      },
    })

    const res = await postCopyFromSeason(req)
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toContain('most recent completed season')
  })
})
