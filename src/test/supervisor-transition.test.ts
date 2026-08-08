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
  GET as getTransition,
  POST as postTransition,
} from '@/app/api/admin/supervisors/[id]/transition/route'
import { DELETE as deleteTeam } from '@/app/api/admin/teams/[id]/route'

describe('admin supervisor transitions', () => {
  let firstUniversity: Awaited<ReturnType<typeof createUniversity>>
  let secondUniversity: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let admin: Awaited<ReturnType<typeof createUser>>
  let supervisor: Awaited<ReturnType<typeof createUser>>

  beforeEach(async () => {
    firstUniversity = await createUniversity('Transition University A')
    secondUniversity = await createUniversity('Transition University B')
    season = (await createSeasonWithRounds({ name: 'Transition Season' })).season
    admin = await createUser({ email: 'admin@transition.test', role: 'ADMIN' })
    supervisor = await createUser({
      email: 'outgoing@transition.test',
      role: 'SUPERVISOR',
      universityId: firstUniversity.id,
      firstName: 'Outgoing',
      lastName: 'Advisor',
    })
  })

  async function prepare(operation: 'CORRECT_AFFILIATION' | 'DEACTIVATE', targetUniversityId?: string) {
    const search = new URLSearchParams({ operation })
    if (targetUniversityId) search.set('targetUniversityId', targetUniversityId)
    const response = await getTransition(
      makeRequest(`http://localhost/api/admin/supervisors/${supervisor.id}/transition?${search.toString()}`),
      { params: Promise.resolve({ id: supervisor.id }) }
    )
    return { response, data: await response.json() }
  }

  it('corrects the supervisor, all current-pointer teams, and students without changing the advisor', async () => {
    const team = await createTeam({
      name: 'Advisor Switch Team',
      supervisorId: supervisor.id,
      universityId: firstUniversity.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    const student = await createUser({
      email: 'student@transition.test',
      role: 'STUDENT',
      universityId: firstUniversity.id,
    })
    await addTeamMember(team.id, student.id, true)
    const teamRequest = await prisma.joinRequest.create({
      data: {
        seasonId: season.id,
        studentId: student.id,
        supervisorId: supervisor.id,
        supervisorEmailEntered: supervisor.email,
        teamId: team.id,
      },
    })
    const teamTicket = await prisma.supportTicket.create({
      data: {
        seasonId: season.id,
        createdById: student.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        assignedToId: supervisor.id,
        subject: 'Team-specific question',
        message: 'Please help our team.',
      },
    })
    await loginAs(admin.id)

    const assignmentsBefore = await prisma.teamSupervisorAssignment.findMany({ where: { teamId: team.id } })
    const { response, data: preflight } = await prepare('CORRECT_AFFILIATION', secondUniversity.id)
    expect(response.status).toBe(200)
    expect(preflight.affectedTeams).toHaveLength(1)
    expect(preflight.affectedStudents).toHaveLength(1)

    const execute = await postTransition(
      makeRequest(`http://localhost/api/admin/supervisors/${supervisor.id}/transition`, {
        method: 'POST',
        body: {
          operation: 'CORRECT_AFFILIATION',
          targetUniversityId: secondUniversity.id,
          typedTargetUniversityName: secondUniversity.name,
          reason: 'University was selected incorrectly during registration',
          fingerprint: preflight.fingerprint,
        },
      }),
      { params: Promise.resolve({ id: supervisor.id }) }
    )
    expect(execute.status).toBe(200)

    const [updatedTeam, updatedSupervisor, updatedStudent, assignments, memberNotice] = await Promise.all([
      prisma.team.findUnique({ where: { id: team.id } }),
      prisma.user.findUnique({ where: { id: supervisor.id } }),
      prisma.user.findUnique({ where: { id: student.id } }),
      prisma.teamSupervisorAssignment.findMany({ where: { teamId: team.id }, orderBy: { startedAt: 'asc' } }),
      prisma.notification.findFirst({ where: { userId: student.id, type: 'TEAM_AFFILIATION_CORRECTED' } }),
    ])
    expect(updatedTeam?.supervisorId).toBe(supervisor.id)
    expect(updatedTeam?.universityId).toBe(secondUniversity.id)
    expect(updatedSupervisor?.universityId).toBe(secondUniversity.id)
    expect(updatedStudent?.universityId).toBe(secondUniversity.id)
    expect(assignments).toEqual(assignmentsBefore)
    expect(memberNotice).not.toBeNull()
    expect((await prisma.joinRequest.findUnique({ where: { id: teamRequest.id } }))?.supervisorId).toBe(supervisor.id)
    const routedTicket = await prisma.supportTicket.findUnique({ where: { id: teamTicket.id } })
    expect(routedTicket?.supervisorId).toBe(supervisor.id)
    expect(routedTicket?.assignedToId).toBe(supervisor.id)
  })

  it('allows temporary unassignment and deactivation without deleting the team', async () => {
    const team = await createTeam({
      name: 'Temporary Gap Team',
      supervisorId: supervisor.id,
      universityId: firstUniversity.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await loginAs(admin.id)
    const { data: preflight } = await prepare('DEACTIVATE')

    const response = await postTransition(
      makeRequest(`http://localhost/api/admin/supervisors/${supervisor.id}/transition`, {
        method: 'POST',
        body: {
          operation: 'DEACTIVATE',
          reason: 'Advisor is temporarily unavailable for the competition',
          fingerprint: preflight.fingerprint,
          teamResolutions: [{ teamId: team.id, action: 'UNASSIGN', supervisorId: null }],
          joinRequestResolutions: [],
          ticketResolutions: [],
        },
      }),
      { params: Promise.resolve({ id: supervisor.id }) }
    )
    expect(response.status).toBe(200)
    expect((await prisma.team.findUnique({ where: { id: team.id } }))?.supervisorId).toBeNull()
    expect((await prisma.user.findUnique({ where: { id: supervisor.id } }))?.isActive).toBe(false)
    expect(await prisma.team.count({ where: { id: team.id } })).toBe(1)
  })

  it('treats completed-season teams as history that does not block a move', async () => {
    const team = await createTeam({
      name: 'Historical Team',
      supervisorId: supervisor.id,
      universityId: firstUniversity.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await prisma.season.update({ where: { id: season.id }, data: { status: 'COMPLETED' } })
    await loginAs(admin.id)
    const { data: preflight } = await prepare('CORRECT_AFFILIATION', secondUniversity.id)
    expect(preflight.affectedTeams.map((entry: { id: string }) => entry.id)).toContain(team.id)

    const response = await postTransition(
      makeRequest(`http://localhost/api/admin/supervisors/${supervisor.id}/transition`, {
        method: 'POST',
        body: {
          operation: 'CORRECT_AFFILIATION',
          targetUniversityId: secondUniversity.id,
          typedTargetUniversityName: secondUniversity.name,
          reason: 'Correcting historical university attribution',
          fingerprint: preflight.fingerprint,
        },
      }),
      { params: Promise.resolve({ id: supervisor.id }) }
    )
    expect(response.status).toBe(200)
    expect((await prisma.team.findUnique({ where: { id: team.id } }))?.supervisorId).toBe(supervisor.id)
    expect((await prisma.team.findUnique({ where: { id: team.id } }))?.universityId).toBe(secondUniversity.id)
  })

  it('rejects a stale transition without partial changes', async () => {
    const team = await createTeam({
      name: 'Concurrent Team',
      supervisorId: supervisor.id,
      universityId: firstUniversity.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await loginAs(admin.id)
    const { data: preflight } = await prepare('CORRECT_AFFILIATION', secondUniversity.id)
    await prisma.team.update({ where: { id: team.id }, data: { name: 'Concurrent Team Updated' } })

    const response = await postTransition(
      makeRequest(`http://localhost/api/admin/supervisors/${supervisor.id}/transition`, {
        method: 'POST',
        body: {
          operation: 'CORRECT_AFFILIATION',
          targetUniversityId: secondUniversity.id,
          typedTargetUniversityName: secondUniversity.name,
          reason: 'This request should be rejected as stale',
          fingerprint: preflight.fingerprint,
        },
      }),
      { params: Promise.resolve({ id: supervisor.id }) }
    )
    expect(response.status).toBe(409)
    expect((await prisma.team.findUnique({ where: { id: team.id } }))?.supervisorId).toBe(supervisor.id)
    expect((await prisma.user.findUnique({ where: { id: supervisor.id } }))?.universityId).toBe(firstUniversity.id)
  })

  it('excludes sub-admins from transition APIs', async () => {
    const subAdmin = await createUser({ email: 'subadmin@transition.test', role: 'SUB_ADMIN', hasFullAccess: true })
    await loginAs(subAdmin.id)
    const { response } = await prepare('CORRECT_AFFILIATION', secondUniversity.id)
    expect(response.status).toBe(403)
  })

  it('blocks the entire correction when a student has another current team outside the correction', async () => {
    const team = await createTeam({ name: 'Correction Team', supervisorId: supervisor.id, universityId: firstUniversity.id, seasonId: season.id, status: 'ACTIVE' })
    const student = await createUser({ email: 'conflict-student@transition.test', role: 'STUDENT', universityId: firstUniversity.id })
    await addTeamMember(team.id, student.id, true)
    const outsideSupervisor = await createUser({ email: 'outside-supervisor@transition.test', role: 'SUPERVISOR', universityId: firstUniversity.id })
    const outsideTeam = await createTeam({ name: 'Outside Team', supervisorId: outsideSupervisor.id, universityId: firstUniversity.id, seasonId: season.id, status: 'ACTIVE' })
    await addTeamMember(outsideTeam.id, student.id)
    await loginAs(admin.id)

    const { data: preflight } = await prepare('CORRECT_AFFILIATION', secondUniversity.id)
    expect(preflight.studentConflicts).toHaveLength(1)
    const response = await postTransition(
      makeRequest(`http://localhost/api/admin/supervisors/${supervisor.id}/transition`, {
        method: 'POST',
        body: {
          operation: 'CORRECT_AFFILIATION',
          targetUniversityId: secondUniversity.id,
          typedTargetUniversityName: secondUniversity.name,
          reason: 'Attempted correction with a membership conflict',
          fingerprint: preflight.fingerprint,
        },
      }),
      { params: Promise.resolve({ id: supervisor.id }) }
    )
    expect(response.status).toBe(409)
    expect((await prisma.user.findUnique({ where: { id: supervisor.id } }))?.universityId).toBe(firstUniversity.id)
    expect((await prisma.team.findUnique({ where: { id: team.id } }))?.universityId).toBe(firstUniversity.id)
  })
})

describe('safe team deletion', () => {
  it('deletes only a clean test team and preserves all member accounts', async () => {
    const university = await createUniversity('Cleanup University')
    const season = (await createSeasonWithRounds({ status: 'DRAFT', name: 'Cleanup Season' })).season
    const admin = await createUser({ email: 'admin@cleanup.test', role: 'ADMIN' })
    const supervisor = await createUser({ email: 'supervisor@cleanup.test', role: 'SUPERVISOR', universityId: university.id })
    const student = await createUser({ email: 'student@cleanup.test', role: 'STUDENT', universityId: university.id })
    const team = await createTeam({ name: 'Mistaken Test Team', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id, status: 'ACTIVE' })
    await addTeamMember(team.id, student.id, true)
    await loginAs(admin.id)

    const response = await deleteTeam(
      makeRequest(`http://localhost/api/admin/teams/${team.id}`, {
        method: 'DELETE',
        body: { confirmDisplayId: team.displayId, reason: 'Mistaken team created during testing' },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )
    expect(response.status).toBe(200)
    expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: student.id } })).not.toBeNull()
    expect(await prisma.auditLog.findFirst({ where: { entityId: team.id, action: 'TEAM_PERMANENTLY_DELETED' } })).not.toBeNull()
  })

  it('blocks permanent deletion when the team contains competition history', async () => {
    const university = await createUniversity('Protected Cleanup University')
    const { season, rounds } = await createSeasonWithRounds({ name: 'Protected Cleanup Season' })
    const admin = await createUser({ email: 'admin@protected-cleanup.test', role: 'ADMIN' })
    const supervisor = await createUser({ email: 'supervisor@protected-cleanup.test', role: 'SUPERVISOR', universityId: university.id })
    const team = await createTeam({ name: 'Protected Team', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id, status: 'ARCHIVED' })
    await prisma.warning.create({ data: { teamId: team.id, roundId: rounds[0].id, type: 'MISSED_SUBMISSION', message: 'Historical warning' } })
    await loginAs(admin.id)

    const response = await deleteTeam(
      makeRequest(`http://localhost/api/admin/teams/${team.id}`, {
        method: 'DELETE',
        body: { confirmDisplayId: team.displayId, reason: 'Attempting unsafe history deletion' },
      }),
      { params: Promise.resolve({ id: team.id }) }
    )
    expect(response.status).toBe(422)
    expect(await prisma.team.findUnique({ where: { id: team.id } })).not.toBeNull()
  })
})
