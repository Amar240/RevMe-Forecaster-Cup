import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import { addTeamMember, createSeasonWithRounds, createTeam, createUniversity, createUser } from './fixtures'

import { POST as postJoinRequest } from '@/app/api/join-requests/route'
import { GET as getJoinRequestSupervisorOptions } from '@/app/api/join-requests/options/route'
import { GET as getJoinableTeams } from '@/app/api/join-requests/teams/route'
import { POST as postSupervisorJoinRequest } from '@/app/api/supervisor/join-requests/route'

describe('Join request flow', () => {
  let activeSeason: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']

  beforeEach(async () => {
    activeSeason = (await createSeasonWithRounds()).season
  })

  it('returns same-university supervisors even when university records differ only by casing', async () => {
    const canonicalUniversity = await createUniversity('Ohio State University')
    const duplicateUniversity = await prisma.university.create({
      data: {
        name: 'ohio state university',
      },
    })
    const otherUniversity = await createUniversity('University of Delaware')

    const student = await createUser({
      email: 'student@join.test',
      role: 'STUDENT',
      universityId: canonicalUniversity.id,
    })
    const sameUniversitySupervisor = await createUser({
      email: 'same-supervisor@join.test',
      role: 'SUPERVISOR',
      universityId: duplicateUniversity.id,
    })
    await createUser({
      email: 'other-supervisor@join.test',
      role: 'SUPERVISOR',
      universityId: otherUniversity.id,
    })

    await loginAs(student.id)
    const res = await getJoinRequestSupervisorOptions()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.studentUniversity.name).toBe('Ohio State University')
    expect(data.supervisors).toHaveLength(1)
    expect(data.supervisors[0].id).toBe(sameUniversitySupervisor.id)
  })

  it('creates a join request using supervisor and team selection', async () => {
    const canonicalUniversity = await createUniversity('Ohio State University')
    const duplicateUniversity = await prisma.university.create({
      data: {
        name: 'OHIO   STATE UNIVERSITY',
      },
    })

    const student = await createUser({
      email: 'selected-team@student.test',
      role: 'STUDENT',
      universityId: canonicalUniversity.id,
    })
    const supervisor = await createUser({
      email: 'selected-team@supervisor.test',
      role: 'SUPERVISOR',
      universityId: duplicateUniversity.id,
    })
    const requestedTeam = await createTeam({
      name: 'Buckeyes',
      supervisorId: supervisor.id,
      universityId: duplicateUniversity.id,
      seasonId: activeSeason.id,
      status: 'ACTIVE',
    })

    await loginAs(student.id)
    const req = makeRequest('http://localhost/api/join-requests', {
      method: 'POST',
      body: {
        supervisorId: supervisor.id,
        teamId: requestedTeam.id,
        message: 'I would like to join this team.',
      },
    })

    const res = await postJoinRequest(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.request.supervisorId).toBe(supervisor.id)
    expect(data.request.teamId).toBe(requestedTeam.id)
    expect(data.request.supervisorEmailEntered).toBe(supervisor.email)
    expect(data.request.requestedTeam.name).toBe('Buckeyes')
  })

  it('filters joinable teams to the active season and joinable statuses', async () => {
    const university = await createUniversity('Team Filter University')
    const student = await createUser({
      email: 'team-filter@student.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'team-filter@supervisor.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const draftSeason = (await createSeasonWithRounds({ status: 'DRAFT', name: 'Draft Season' })).season

    const activeTeam = await createTeam({
      name: 'Active Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: activeSeason.id,
      status: 'ACTIVE',
    })
    await createTeam({
      name: 'Rejected Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: activeSeason.id,
      status: 'REJECTED',
    })
    await createTeam({
      name: 'Draft Season Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: draftSeason.id,
      status: 'ACTIVE',
    })

    await loginAs(student.id)
    const req = makeRequest(`http://localhost/api/join-requests/teams?supervisorId=${supervisor.id}`)
    const res = await getJoinableTeams(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.teams).toHaveLength(1)
    expect(data.teams[0].id).toBe(activeTeam.id)
  })

  it('supervisor accept defaults to the requested team when one was selected', async () => {
    const university = await createUniversity('Accept University')
    const student = await createUser({
      email: 'accept@student.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'accept@supervisor.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const requestedTeam = await createTeam({
      name: 'Requested Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: activeSeason.id,
      status: 'ACTIVE',
    })

    const joinRequest = await prisma.joinRequest.create({
      data: {
        studentId: student.id,
        supervisorId: supervisor.id,
        supervisorEmailEntered: supervisor.email,
        teamId: requestedTeam.id,
        seasonId: activeSeason.id,
        status: 'PENDING',
      },
    })

    await loginAs(supervisor.id)
    const req = makeRequest('http://localhost/api/supervisor/join-requests', {
      method: 'POST',
      body: {
        requestId: joinRequest.id,
        action: 'accept',
      },
    })

    const res = await postSupervisorJoinRequest(req)
    expect(res.status).toBe(200)

    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: student.id,
      },
    })

    expect(membership?.teamId).toBe(requestedTeam.id)
  })

  it('allows a student with only prior-season membership to create a current-season join request', async () => {
    const university = await createUniversity('Historical Join University')
    const student = await createUser({
      email: 'historical-join@student.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'historical-join@supervisor.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })

    const oldSeason = (await createSeasonWithRounds({ name: 'Old Join Season' })).season
    await prisma.season.update({
      where: { id: oldSeason.id },
      data: { status: 'COMPLETED' },
    })

    const historicalTeam = await createTeam({
      name: 'Historical Join Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: oldSeason.id,
      status: 'ACTIVE',
    })
    await addTeamMember(historicalTeam.id, student.id, true)

    await loginAs(student.id)
    const req = makeRequest('http://localhost/api/join-requests', {
      method: 'POST',
      body: {
        supervisorId: supervisor.id,
        message: 'Joining for the new season.',
      },
    })

    const res = await postJoinRequest(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.request.seasonId).toBe(activeSeason.id)
  })

  it('rejects supervisor acceptance when the student is already assigned in the same season', async () => {
    const university = await createUniversity('Join Conflict University')
    const student = await createUser({
      email: 'season-conflict@student.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'season-conflict@supervisor.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })

    const existingTeam = await createTeam({
      name: 'Existing Season Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: activeSeason.id,
      status: 'ACTIVE',
    })
    const requestedTeam = await createTeam({
      name: 'Requested Season Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: activeSeason.id,
      status: 'ACTIVE',
    })
    await addTeamMember(existingTeam.id, student.id, true)

    const joinRequest = await prisma.joinRequest.create({
      data: {
        studentId: student.id,
        supervisorId: supervisor.id,
        supervisorEmailEntered: supervisor.email,
        teamId: requestedTeam.id,
        seasonId: activeSeason.id,
        status: 'PENDING',
      },
    })

    await loginAs(supervisor.id)
    const req = makeRequest('http://localhost/api/supervisor/join-requests', {
      method: 'POST',
      body: {
        requestId: joinRequest.id,
        action: 'accept',
      },
    })

    const res = await postSupervisorJoinRequest(req)
    expect(res.status).toBe(409)
  })
})
