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

import { GET as getTeamsHandler, POST as createTeamHandler } from '@/app/api/teams/route'
import { POST as addMemberHandler } from '@/app/api/teams/[id]/members/route'
import { PATCH as setSubmitterHandler } from '@/app/api/teams/[id]/submitter/route'
import { POST as joinRequestHandler } from '@/app/api/join-requests/route'
import { POST as supervisorJoinRequestHandler } from '@/app/api/supervisor/join-requests/route'
import { POST as disqualifyTeamHandler } from '@/app/api/admin/teams/[id]/disqualify/route'
import { POST as reinstateTeamHandler } from '@/app/api/admin/teams/[id]/reinstate/route'

const BASE = 'http://localhost:5000'

describe('Team management flow', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let admin: Awaited<ReturnType<typeof createUser>>
  let student: Awaited<ReturnType<typeof createUser>>
  let teammate: Awaited<ReturnType<typeof createUser>>
  let team: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await createUniversity('Team Management University')
    season = (await createSeasonWithRounds({ status: 'ACTIVE', name: 'Team Management Season' })).season
    supervisor = await createUser({
      email: 'supervisor@team-mgmt.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    admin = await createUser({
      email: 'admin@team-mgmt.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    student = await createUser({
      email: 'student@team-mgmt.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    teammate = await createUser({
      email: 'teammate@team-mgmt.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    team = await createTeam({
      name: 'Managed Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(team.id, student.id, true)
  })

  it('allows a supervisor to create a team', async () => {
    await loginAs(supervisor.id)

    const res = await createTeamHandler(
      makeRequest(`${BASE}/api/teams`, {
        method: 'POST',
        body: { name: 'Supervisor Created Team' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.team.name).toBe('Supervisor Created Team')
    expect(data.team.supervisorId).toBe(supervisor.id)
  })

  it('prevents a supervisor from creating more than 10 teams', async () => {
    for (let index = 0; index < 9; index += 1) {
      await createTeam({
        name: `Extra Team ${index}`,
        displayId: `TM-${index}`,
        supervisorId: supervisor.id,
        universityId: university.id,
        seasonId: season.id,
        status: 'ACTIVE',
      })
    }

    await loginAs(supervisor.id)
    const res = await createTeamHandler(
      makeRequest(`${BASE}/api/teams`, {
        method: 'POST',
        body: { name: 'Team Eleven' },
      })
    )

    expect(res.status).toBe(422)
  })

  it('rejects team-name collisions in the same season', async () => {
    await loginAs(supervisor.id)
    const res = await createTeamHandler(
      makeRequest(`${BASE}/api/teams`, {
        method: 'POST',
        body: { name: 'Managed Team' },
      })
    )

    expect(res.status).toBe(422)
  })

  it('allows a supervisor to add a student to their team', async () => {
    await loginAs(supervisor.id)

    const res = await addMemberHandler(
      makeRequest(`${BASE}/api/teams/${team.id}/members`, {
        method: 'POST',
        body: { userId: teammate.id },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.member.userId).toBe(teammate.id)
  })

  it('does not allow adding the same student twice', async () => {
    await loginAs(supervisor.id)

    const firstRes = await addMemberHandler(
      makeRequest(`${BASE}/api/teams/${team.id}/members`, {
        method: 'POST',
        body: { userId: teammate.id },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )
    expect(firstRes.status).toBe(201)

    const secondRes = await addMemberHandler(
      makeRequest(`${BASE}/api/teams/${team.id}/members`, {
        method: 'POST',
        body: { userId: teammate.id },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )

    expect(secondRes.status).toBe(409)
  })

  it('does not allow a team to exceed five members', async () => {
    const extraStudents = await Promise.all(
      Array.from({ length: 4 }, async (_, index) =>
        createUser({
          email: `extra-${index}@team-mgmt.test`,
          role: 'STUDENT',
          universityId: university.id,
        })
      )
    )

    for (const extraStudent of extraStudents.slice(0, 3)) {
      await addTeamMember(team.id, extraStudent.id, false)
    }

    await loginAs(supervisor.id)

    const fifthRes = await addMemberHandler(
      makeRequest(`${BASE}/api/teams/${team.id}/members`, {
        method: 'POST',
        body: { userId: extraStudents[3].id },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )
    expect(fifthRes.status).toBe(201)

    const overflowStudent = await createUser({
      email: 'overflow@team-mgmt.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const overflowRes = await addMemberHandler(
      makeRequest(`${BASE}/api/teams/${team.id}/members`, {
        method: 'POST',
        body: { userId: overflowStudent.id },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )

    expect(overflowRes.status).toBe(422)
  })

  it('allows a supervisor to set a team submitter', async () => {
    await addTeamMember(team.id, teammate.id, false)
    const teammateMembership = await prisma.teamMember.findFirstOrThrow({
      where: { teamId: team.id, userId: teammate.id },
    })

    await loginAs(supervisor.id)
    const res = await setSubmitterHandler(
      makeRequest(`${BASE}/api/teams/${team.id}/submitter`, {
        method: 'PATCH',
        body: { memberId: teammateMembership.id },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )

    expect(res.status).toBe(200)
  })

  it('keeps exactly one submitter per team', async () => {
    await addTeamMember(team.id, teammate.id, false)
    const teammateMembership = await prisma.teamMember.findFirstOrThrow({
      where: { teamId: team.id, userId: teammate.id },
    })

    await loginAs(supervisor.id)
    const res = await setSubmitterHandler(
      makeRequest(`${BASE}/api/teams/${team.id}/submitter`, {
        method: 'PATCH',
        body: { memberId: teammateMembership.id },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )
    expect(res.status).toBe(200)

    const members = await prisma.teamMember.findMany({
      where: { teamId: team.id },
    })
    const submitters = members.filter((member) => member.isSubmitter)
    expect(submitters).toHaveLength(1)
    expect(submitters[0].id).toBe(teammateMembership.id)
  })

  it('allows a student to create a join request', async () => {
    const requester = await createUser({
      email: 'join-request@student.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(requester.id)
    const res = await joinRequestHandler(
      makeRequest(`${BASE}/api/join-requests`, {
        method: 'POST',
        body: { supervisorId: supervisor.id, teamId: team.id, message: 'Please add me.' },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.request.studentId).toBe(requester.id)
    expect(data.request.supervisorId).toBe(supervisor.id)
  })

  it('allows a supervisor to approve a join request', async () => {
    const requester = await createUser({
      email: 'approve-request@student.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(requester.id)
    const createRes = await joinRequestHandler(
      makeRequest(`${BASE}/api/join-requests`, {
        method: 'POST',
        body: { supervisorId: supervisor.id, teamId: team.id },
      })
    )
    const createData = await createRes.json()
    expect(createRes.status).toBe(200)

    await loginAs(supervisor.id)
    const approveRes = await supervisorJoinRequestHandler(
      makeRequest(`${BASE}/api/supervisor/join-requests`, {
        method: 'POST',
        body: {
          requestId: createData.request.id,
          action: 'accept',
          teamId: team.id,
        },
      })
    )
    expect(approveRes.status).toBe(200)

    const membership = await prisma.teamMember.findFirst({
      where: { teamId: team.id, userId: requester.id },
    })
    expect(membership).not.toBeNull()
  })

  it('allows a supervisor to reject a join request', async () => {
    const requester = await createUser({
      email: 'reject-request@student.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(requester.id)
    const createRes = await joinRequestHandler(
      makeRequest(`${BASE}/api/join-requests`, {
        method: 'POST',
        body: { supervisorId: supervisor.id, teamId: team.id },
      })
    )
    const createData = await createRes.json()
    expect(createRes.status).toBe(200)

    await loginAs(supervisor.id)
    const rejectRes = await supervisorJoinRequestHandler(
      makeRequest(`${BASE}/api/supervisor/join-requests`, {
        method: 'POST',
        body: {
          requestId: createData.request.id,
          action: 'reject',
        },
      })
    )
    expect(rejectRes.status).toBe(200)

    const joinRequest = await prisma.joinRequest.findUniqueOrThrow({
      where: { id: createData.request.id },
    })
    expect(joinRequest.status).toBe('REJECTED')
  })

  it('allows an admin to disqualify a team', async () => {
    await loginAs(admin.id)
    const res = await disqualifyTeamHandler(
      makeRequest(`${BASE}/api/admin/teams/${team.id}/disqualify`, {
        method: 'POST',
        body: { reason: 'Policy breach' },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )

    expect(res.status).toBe(200)
  })

  it('allows an admin to reinstate a disqualified team', async () => {
    await prisma.team.update({
      where: { id: team.id },
      data: { status: 'DISQUALIFIED', disqualifiedAt: new Date(), disqualifiedReason: 'Policy breach' },
    })

    await loginAs(admin.id)
    const res = await reinstateTeamHandler(
      makeRequest(`${BASE}/api/admin/teams/${team.id}/reinstate`, {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: team.id }) }
    )

    expect(res.status).toBe(200)
  })

  it('persists DISQUALIFIED status in the database after admin disqualification', async () => {
    await loginAs(admin.id)
    const res = await disqualifyTeamHandler(
      makeRequest(`${BASE}/api/admin/teams/${team.id}/disqualify`, {
        method: 'POST',
        body: { reason: 'Too many warnings' },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )
    expect(res.status).toBe(200)

    const updated = await prisma.team.findUniqueOrThrow({
      where: { id: team.id },
    })
    expect(updated.status).toBe('DISQUALIFIED')
  })

  it('uses GET /api/teams as the supervisor-scoped team list endpoint', async () => {
    const otherSupervisor = await createUser({
      email: 'other-supervisor@team-mgmt.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    await createTeam({
      name: 'Other Supervisor Team',
      supervisorId: otherSupervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(supervisor.id)
    const res = await getTeamsHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.teams.map((listedTeam: { id: string }) => listedTeam.id)).toContain(team.id)
    expect(data.teams.some((listedTeam: { supervisorId: string }) => listedTeam.supervisorId === otherSupervisor.id)).toBe(false)
  })
})
