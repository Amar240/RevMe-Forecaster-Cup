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
import { PATCH as patchSupervisorTeam } from '@/app/api/teams/[id]/route'
import { POST as addSupervisorMember } from '@/app/api/teams/[id]/members/route'
import { DELETE as removeSupervisorMember } from '@/app/api/teams/[id]/members/[memberId]/route'
import { PATCH as patchSupervisorSubmitter } from '@/app/api/teams/[id]/submitter/route'
import { PATCH as patchAdminTeam } from '@/app/api/admin/teams/[id]/route'
import { POST as addAdminMember } from '@/app/api/admin/teams/[id]/members/route'
import { PATCH as patchAdminSupervisor } from '@/app/api/admin/teams/[id]/supervisor/route'
import { POST as postAdminMoveMembers } from '@/app/api/admin/teams/move-members/route'

describe('Team roster APIs', () => {
  let university: Awaited<ReturnType<typeof createUniversity>>
  let secondUniversity: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let otherSupervisor: Awaited<ReturnType<typeof createUser>>
  let admin: Awaited<ReturnType<typeof createUser>>
  let fullSubAdmin: Awaited<ReturnType<typeof createUser>>
  let team: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await createUniversity('Roster University')
    secondUniversity = await createUniversity('Other Roster University')
    season = (await createSeasonWithRounds()).season
    supervisor = await createUser({
      email: 'supervisor@roster.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    otherSupervisor = await createUser({
      email: 'other-supervisor@roster.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    admin = await createUser({
      email: 'admin@roster.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    fullSubAdmin = await createUser({
      email: 'subadmin@roster.test',
      role: 'SUB_ADMIN',
      universityId: university.id,
      hasFullAccess: true,
    })
    team = await createTeam({
      name: 'Roster Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
  })

  it('admin can rename a team', async () => {
    await loginAs(admin.id)

    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}`, {
      method: 'PATCH',
      body: { name: 'Renamed Team' },
    })
    const res = await patchAdminTeam(req, { params: Promise.resolve({ id: team.id }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.team.name).toBe('Renamed Team')

    const updated = await prisma.team.findUnique({ where: { id: team.id } })
    expect(updated?.name).toBe('Renamed Team')
  })

  it('duplicate rename is rejected', async () => {
    await createTeam({
      name: 'Existing Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}`, {
      method: 'PATCH',
      body: { name: 'Existing Team' },
    })
    const res = await patchAdminTeam(req, { params: Promise.resolve({ id: team.id }) })

    expect(res.status).toBe(422)
  })

  it('admin add member assigns first member as submitter', async () => {
    const student = await createUser({
      email: 'student1@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}/members`, {
      method: 'POST',
      body: { userId: student.id },
    })
    const res = await addAdminMember(req, { params: Promise.resolve({ id: team.id }) })
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.member.isSubmitter).toBe(true)

    const members = await prisma.teamMember.findMany({ where: { teamId: team.id } })
    expect(members).toHaveLength(1)
    expect(members[0].isSubmitter).toBe(true)
  })

  it('admin add member rejects students from another university', async () => {
    const outsider = await createUser({
      email: 'outsider@roster.test',
      role: 'STUDENT',
      universityId: secondUniversity.id,
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}/members`, {
      method: 'POST',
      body: { userId: outsider.id },
    })
    const res = await addAdminMember(req, { params: Promise.resolve({ id: team.id }) })

    expect(res.status).toBe(422)
  })

  it('admin add member rejects an already assigned student', async () => {
    const student = await createUser({
      email: 'assigned@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    await addTeamMember(team.id, student.id, true)

    const secondTeam = await createTeam({
      name: 'Second Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${secondTeam.id}/members`, {
      method: 'POST',
      body: { userId: student.id },
    })
    const res = await addAdminMember(req, { params: Promise.resolve({ id: secondTeam.id }) })

    expect(res.status).toBe(409)
  })

  it('removing the current submitter without replacement is rejected', async () => {
    const submitter = await createUser({
      email: 'submitter@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const teammate = await createUser({
      email: 'teammate@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const submitterMember = await addTeamMember(team.id, submitter.id, true)
    await addTeamMember(team.id, teammate.id, false)

    await loginAs(supervisor.id)
    const req = makeRequest(`http://localhost/api/teams/${team.id}/members/${submitterMember.id}`, {
      method: 'DELETE',
    })
    const res = await removeSupervisorMember(req, {
      params: Promise.resolve({ id: team.id, memberId: submitterMember.id }),
    })

    expect(res.status).toBe(422)
  })

  it('removing the current submitter with replacement succeeds', async () => {
    const submitter = await createUser({
      email: 'submitter2@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const teammate = await createUser({
      email: 'teammate2@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const submitterMember = await addTeamMember(team.id, submitter.id, true)
    const teammateMember = await addTeamMember(team.id, teammate.id, false)

    await loginAs(supervisor.id)
    const req = makeRequest(`http://localhost/api/teams/${team.id}/members/${submitterMember.id}`, {
      method: 'DELETE',
      body: { replacementMemberId: teammateMember.id },
    })
    const res = await removeSupervisorMember(req, {
      params: Promise.resolve({ id: team.id, memberId: submitterMember.id }),
    })

    expect(res.status).toBe(200)

    const members = await prisma.teamMember.findMany({
      where: { teamId: team.id },
      orderBy: { joinedAt: 'asc' },
    })
    expect(members).toHaveLength(1)
    expect(members[0].id).toBe(teammateMember.id)
    expect(members[0].isSubmitter).toBe(true)
  })

  it('submitter update leaves exactly one submitter', async () => {
    const studentA = await createUser({
      email: 'studenta@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const studentB = await createUser({
      email: 'studentb@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    await addTeamMember(team.id, studentA.id, true)
    const memberB = await addTeamMember(team.id, studentB.id, false)

    await loginAs(supervisor.id)
    const req = makeRequest(`http://localhost/api/teams/${team.id}/submitter`, {
      method: 'PATCH',
      body: { memberId: memberB.id },
    })
    const res = await patchSupervisorSubmitter(req, { params: Promise.resolve({ id: team.id }) })

    expect(res.status).toBe(200)

    const members = await prisma.teamMember.findMany({ where: { teamId: team.id } })
    const submitters = members.filter((member) => member.isSubmitter)
    expect(submitters).toHaveLength(1)
    expect(submitters[0].id).toBe(memberB.id)
  })

  it('supervisor can rename their own team', async () => {
    await loginAs(supervisor.id)

    const req = makeRequest(`http://localhost/api/teams/${team.id}`, {
      method: 'PATCH',
      body: { name: 'Supervisor Updated Team' },
    })
    const res = await patchSupervisorTeam(req, { params: Promise.resolve({ id: team.id }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.team.name).toBe('Supervisor Updated Team')
  })

  it('supervisor cannot mutate another supervisors team', async () => {
    const otherTeam = await createTeam({
      name: 'Other Supervisor Team',
      supervisorId: otherSupervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(supervisor.id)
    const req = makeRequest(`http://localhost/api/teams/${otherTeam.id}`, {
      method: 'PATCH',
      body: { name: 'Blocked Rename' },
    })
    const res = await patchSupervisorTeam(req, { params: Promise.resolve({ id: otherTeam.id }) })

    expect(res.status).toBe(403)
  })

  it('full access sub-admin can use admin roster routes', async () => {
    const student = await createUser({
      email: 'subadmin-student@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(fullSubAdmin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}/members`, {
      method: 'POST',
      body: { userId: student.id },
    })
    const res = await addAdminMember(req, { params: Promise.resolve({ id: team.id }) })

    expect(res.status).toBe(201)
  })

  it('supervisor add member route works with email lookup through the shared service', async () => {
    const student = await createUser({
      email: 'email-lookup@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(supervisor.id)
    const req = makeRequest(`http://localhost/api/teams/${team.id}/members`, {
      method: 'POST',
      body: { email: student.email },
    })
    const res = await addSupervisorMember(req, { params: Promise.resolve({ id: team.id }) })

    expect(res.status).toBe(201)
  })

  it('admin can reassign a supervisor within the same university', async () => {
    await loginAs(admin.id)

    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}/supervisor`, {
      method: 'PATCH',
      body: { supervisorId: otherSupervisor.id },
    })
    const res = await patchAdminSupervisor(req, { params: Promise.resolve({ id: team.id }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.team.supervisorId).toBe(otherSupervisor.id)

    const updated = await prisma.team.findUnique({ where: { id: team.id } })
    expect(updated?.supervisorId).toBe(otherSupervisor.id)
  })

  it('supervisor reassignment rejects a non-supervisor user', async () => {
    const student = await createUser({
      email: 'not-a-supervisor@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}/supervisor`, {
      method: 'PATCH',
      body: { supervisorId: student.id },
    })
    const res = await patchAdminSupervisor(req, { params: Promise.resolve({ id: team.id }) })

    expect(res.status).toBe(422)
  })

  it('supervisor reassignment rejects supervisors from another university', async () => {
    const outsideSupervisor = await createUser({
      email: 'outside-supervisor@roster.test',
      role: 'SUPERVISOR',
      universityId: secondUniversity.id,
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/teams/${team.id}/supervisor`, {
      method: 'PATCH',
      body: { supervisorId: outsideSupervisor.id },
    })
    const res = await patchAdminSupervisor(req, { params: Promise.resolve({ id: team.id }) })

    expect(res.status).toBe(422)
  })

  it('moving the source submitter without replacement is rejected', async () => {
    const submitter = await createUser({
      email: 'move-submit@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const teammate = await createUser({
      email: 'move-teammate@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const submitterMember = await addTeamMember(team.id, submitter.id, true)
    await addTeamMember(team.id, teammate.id, false)

    const targetTeam = await createTeam({
      name: 'Target Team',
      supervisorId: otherSupervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest('http://localhost/api/admin/teams/move-members', {
      method: 'POST',
      body: {
        sourceTeamId: team.id,
        targetTeamId: targetTeam.id,
        memberIds: [submitterMember.id],
      },
    })
    const res = await postAdminMoveMembers(req)

    expect(res.status).toBe(422)
  })

  it('moving members into a team without a submitter requires target submitter selection', async () => {
    const submitter = await createUser({
      email: 'move-source-submit@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const teammate = await createUser({
      email: 'move-source-stay@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const submitterMember = await addTeamMember(team.id, submitter.id, true)
    const teammateMember = await addTeamMember(team.id, teammate.id, false)

    const targetTeam = await createTeam({
      name: 'Target Without Submitter',
      supervisorId: otherSupervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest('http://localhost/api/admin/teams/move-members', {
      method: 'POST',
      body: {
        sourceTeamId: team.id,
        targetTeamId: targetTeam.id,
        memberIds: [submitterMember.id],
        sourceReplacementMemberId: teammateMember.id,
      },
    })
    const res = await postAdminMoveMembers(req)

    expect(res.status).toBe(422)
  })

  it('successful member move updates source and target submitters safely', async () => {
    const movingSubmitter = await createUser({
      email: 'bulk-move-submit@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const movingStudent = await createUser({
      email: 'bulk-move-student@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const remainingStudent = await createUser({
      email: 'bulk-move-remaining@roster.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const sourceSubmitterMember = await addTeamMember(team.id, movingSubmitter.id, true)
    const movedMember = await addTeamMember(team.id, movingStudent.id, false)
    const remainingMember = await addTeamMember(team.id, remainingStudent.id, false)

    const targetTeam = await createTeam({
      name: 'Safe Move Target',
      supervisorId: otherSupervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)
    const req = makeRequest('http://localhost/api/admin/teams/move-members', {
      method: 'POST',
      body: {
        sourceTeamId: team.id,
        targetTeamId: targetTeam.id,
        memberIds: [sourceSubmitterMember.id, movedMember.id],
        sourceReplacementMemberId: remainingMember.id,
        targetSubmitterMemberId: sourceSubmitterMember.id,
      },
    })
    const res = await postAdminMoveMembers(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.sourceTeam.members).toHaveLength(1)
    expect(data.sourceTeam.members[0].id).toBe(remainingMember.id)
    expect(data.sourceTeam.members[0].isSubmitter).toBe(true)
    expect(data.targetTeam.members).toHaveLength(2)

    const refreshedSourceSubmitter = await prisma.teamMember.findUnique({ where: { id: sourceSubmitterMember.id } })
    const refreshedMovedMember = await prisma.teamMember.findUnique({ where: { id: movedMember.id } })
    const refreshedRemaining = await prisma.teamMember.findUnique({ where: { id: remainingMember.id } })

    expect(refreshedSourceSubmitter?.teamId).toBe(targetTeam.id)
    expect(refreshedSourceSubmitter?.isSubmitter).toBe(true)
    expect(refreshedMovedMember?.teamId).toBe(targetTeam.id)
    expect(refreshedMovedMember?.isSubmitter).toBe(false)
    expect(refreshedRemaining?.teamId).toBe(team.id)
    expect(refreshedRemaining?.isSubmitter).toBe(true)
  })
})
