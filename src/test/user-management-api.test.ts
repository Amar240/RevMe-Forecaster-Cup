import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import {
  addTeamMember,
  createMarkets,
  createSeasonWithRounds,
  createSubmission,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'

import { GET as getAdminUsers, POST as postAdminUsers } from '@/app/api/admin/users/route'
import { PATCH as patchAdminUser } from '@/app/api/admin/users/[id]/route'
import { DELETE as deleteAdminUser } from '@/app/api/admin/users/[id]/delete/route'
import { PATCH as patchAdminUserStatus } from '@/app/api/admin/users/[id]/status/route'
import { POST as postAdminSupervisors } from '@/app/api/admin/supervisors/route'
import { PATCH as patchAdminSupervisor } from '@/app/api/admin/supervisors/[id]/route'
import { PATCH as patchAdminSupervisorStatus } from '@/app/api/admin/supervisors/[id]/status/route'
import { GET as getSupervisorStudents, POST as postSupervisorStudents } from '@/app/api/supervisor/students/route'
import { PATCH as patchSupervisorStudent } from '@/app/api/supervisor/students/[id]/route'

const BASE = 'http://localhost:5000'

describe('admin student management', () => {
  it('creates a student from /api/admin/users', async () => {
    const admin = await createUser({ email: 'admin@users-manage.test', role: 'ADMIN' })
    const university = await createUniversity('Student Create University')
    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users`, {
      method: 'POST',
      body: {
        firstName: 'Maya',
        lastName: 'Student',
        email: 'maya@student-create.test',
        universityId: university.id,
      },
    })

    const res = await postAdminUsers(req)
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.user.role).toBe('STUDENT')
    expect(data.user.universityId).toBe(university.id)

    const createdUser = await prisma.user.findUnique({
      where: { email: 'maya@student-create.test' },
    })
    expect(createdUser?.resetToken).toBeTruthy()
    expect(createdUser?.isActive).toBe(true)
  })

  it('updates student fields and blocks unsafe university changes after team membership', async () => {
    const admin = await createUser({ email: 'admin@student-edit.test', role: 'ADMIN' })
    const firstUniversity = await createUniversity('Edit University One')
    const secondUniversity = await createUniversity('Edit University Two')
    const supervisor = await createUser({
      email: 'supervisor@student-edit.test',
      role: 'SUPERVISOR',
      universityId: firstUniversity.id,
    })
    const student = await createUser({
      email: 'student@student-edit.test',
      role: 'STUDENT',
      universityId: firstUniversity.id,
    })

    await loginAs(admin.id)

    const safeReq = makeRequest(`${BASE}/api/admin/users/${student.id}`, {
      method: 'PATCH',
      body: {
        firstName: 'Updated',
        lastName: 'Student',
        email: 'updated@student-edit.test',
        universityId: firstUniversity.id,
      },
    })

    const safeRes = await patchAdminUser(safeReq, { params: Promise.resolve({ id: student.id }) })
    expect(safeRes.status).toBe(200)

    const updatedUser = await prisma.user.findUnique({ where: { id: student.id } })
    expect(updatedUser?.email).toBe('updated@student-edit.test')

    const team = await createTeam({
      name: 'Membership Team',
      supervisorId: supervisor.id,
      universityId: firstUniversity.id,
    })
    await addTeamMember(team.id, student.id, true)

    const blockedReq = makeRequest(`${BASE}/api/admin/users/${student.id}`, {
      method: 'PATCH',
      body: {
        firstName: 'Updated',
        lastName: 'Student',
        email: 'updated@student-edit.test',
        universityId: secondUniversity.id,
      },
    })

    const blockedRes = await patchAdminUser(blockedReq, { params: Promise.resolve({ id: student.id }) })
    expect(blockedRes.status).toBe(422)

    const blockedData = await blockedRes.json()
    expect(blockedData.message).toContain('Student university cannot be changed')
  })

  it('deactivates and reactivates a student while clearing their sessions', async () => {
    const admin = await createUser({ email: 'admin@student-status.test', role: 'ADMIN' })
    const university = await createUniversity('Status University')
    const student = await createUser({
      email: 'student@student-status.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(admin.id)

    await prisma.session.create({
      data: {
        userId: student.id,
        token: crypto.randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    const deactivateReq = makeRequest(`${BASE}/api/admin/users/${student.id}/status`, {
      method: 'PATCH',
      body: { isActive: false },
    })

    const deactivateRes = await patchAdminUserStatus(deactivateReq, {
      params: Promise.resolve({ id: student.id }),
    })
    expect(deactivateRes.status).toBe(200)

    const deactivatedUser = await prisma.user.findUnique({ where: { id: student.id } })
    expect(deactivatedUser?.isActive).toBe(false)

    const remainingSessions = await prisma.session.count({
      where: { userId: student.id },
    })
    expect(remainingSessions).toBe(0)

    const reactivateReq = makeRequest(`${BASE}/api/admin/users/${student.id}/status`, {
      method: 'PATCH',
      body: { isActive: true },
    })

    const reactivateRes = await patchAdminUserStatus(reactivateReq, {
      params: Promise.resolve({ id: student.id }),
    })
    expect(reactivateRes.status).toBe(200)

    const reactivatedUser = await prisma.user.findUnique({ where: { id: student.id } })
    expect(reactivatedUser?.isActive).toBe(true)
  })

  it('keeps supervisor creation on the supervisors route and student creation on the users route', async () => {
    const admin = await createUser({ email: 'admin@surface-split.test', role: 'ADMIN' })
    const university = await createUniversity('Surface Split University')
    await loginAs(admin.id)

    const studentReq = makeRequest(`${BASE}/api/admin/users`, {
      method: 'POST',
      body: {
        firstName: 'Student',
        lastName: 'Surface',
        email: 'student@surface-split.test',
        universityId: university.id,
      },
    })
    const studentRes = await postAdminUsers(studentReq)
    expect(studentRes.status).toBe(201)
    const studentData = await studentRes.json()
    expect(studentData.user.role).toBe('STUDENT')

    const supervisorReq = makeRequest(`${BASE}/api/admin/supervisors`, {
      method: 'POST',
      body: {
        firstName: 'Supervisor',
        lastName: 'Surface',
        email: 'supervisor@surface-split.test',
        universityId: university.id,
      },
    })
    const supervisorRes = await postAdminSupervisors(supervisorReq)
    expect(supervisorRes.status).toBe(201)
    const supervisorData = await supervisorRes.json()
    expect(supervisorData.supervisor.email).toBe('supervisor@surface-split.test')
  })

  it('deletes a clean student account and writes an audit log entry', async () => {
    const admin = await createUser({ email: 'admin@student-delete.test', role: 'ADMIN' })
    const university = await createUniversity('Student Delete University')
    const student = await createUser({
      email: 'student@student-delete.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${student.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: student.id }) })
    expect(res.status).toBe(200)

    const deletedUser = await prisma.user.findUnique({ where: { id: student.id } })
    expect(deletedUser).toBeNull()

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'USER_DELETED',
        entityType: 'User',
        entityId: student.id,
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(auditLog).not.toBeNull()
    expect(auditLog?.userId).toBe(admin.id)
  })

  it('surfaces delete eligibility and blocked reasons in the admin users list', async () => {
    const admin = await createUser({ email: 'admin@delete-surface.test', role: 'ADMIN' })
    const university = await createUniversity('Delete Surface University')
    const supervisor = await createUser({
      email: 'supervisor@delete-surface.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const cleanStudent = await createUser({
      email: 'clean-student@delete-surface.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const memberStudent = await createUser({
      email: 'member-student@delete-surface.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const team = await createTeam({
      name: 'Delete Surface Team',
      supervisorId: supervisor.id,
      universityId: university.id,
    })
    await addTeamMember(team.id, memberStudent.id, true)

    await loginAs(admin.id)

    const res = await getAdminUsers()
    expect(res.status).toBe(200)

    const data = await res.json()
    const cleanStudentRow = data.users.find((user: { id: string }) => user.id === cleanStudent.id)
    const memberStudentRow = data.users.find((user: { id: string }) => user.id === memberStudent.id)
    const supervisorRow = data.users.find((user: { id: string }) => user.id === supervisor.id)

    expect(cleanStudentRow.canDelete).toBe(true)
    expect(cleanStudentRow.deleteBlockedReason).toBeNull()
    expect(memberStudentRow.canDelete).toBe(false)
    expect(memberStudentRow.deleteBlockedReason).toContain('team memberships')
    expect(supervisorRow.canDelete).toBe(false)
    expect(supervisorRow.deleteBlockedReason).toContain('Only clean student accounts')
  })

  it('blocks self-delete', async () => {
    const admin = await createUser({ email: 'admin@self-delete.test', role: 'ADMIN' })
    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${admin.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: admin.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('own account')
  })

  it('blocks deleting non-student accounts', async () => {
    const admin = await createUser({ email: 'admin@delete-scope.test', role: 'ADMIN' })
    const university = await createUniversity('Delete Scope University')
    const supervisor = await createUser({
      email: 'supervisor@delete-scope.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${supervisor.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: supervisor.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('Only clean student accounts')
  })

  it('blocks deleting a student with team membership', async () => {
    const admin = await createUser({ email: 'admin@delete-team-membership.test', role: 'ADMIN' })
    const university = await createUniversity('Delete Membership University')
    const supervisor = await createUser({
      email: 'supervisor@delete-team-membership.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@delete-team-membership.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const team = await createTeam({
      name: 'Delete Membership Team',
      supervisorId: supervisor.id,
      universityId: university.id,
    })
    await addTeamMember(team.id, student.id, true)

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${student.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: student.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('team memberships')
  })

  it('blocks deleting a student with submissions', async () => {
    const admin = await createUser({ email: 'admin@delete-submission.test', role: 'ADMIN' })
    const university = await createUniversity('Delete Submission University')
    const supervisor = await createUser({
      email: 'supervisor@delete-submission.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@delete-submission.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const { season, rounds } = await createSeasonWithRounds()
    await createMarkets(season.id)
    const team = await createTeam({
      name: 'Delete Submission Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
    })

    await createSubmission({
      teamId: team.id,
      roundId: rounds[0].id,
      submittedById: student.id,
      values: [],
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${student.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: student.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('submissions')
  })

  it('blocks deleting a student with join requests', async () => {
    const admin = await createUser({ email: 'admin@delete-join-request.test', role: 'ADMIN' })
    const university = await createUniversity('Delete Join Request University')
    const student = await createUser({
      email: 'student@delete-join-request.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await prisma.joinRequest.create({
      data: {
        studentId: student.id,
        status: 'PENDING',
      },
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${student.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: student.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('join request')
  })

  it('blocks deleting a student with support tickets', async () => {
    const admin = await createUser({ email: 'admin@delete-ticket.test', role: 'ADMIN' })
    const university = await createUniversity('Delete Ticket University')
    const student = await createUser({
      email: 'student@delete-ticket.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await prisma.supportTicket.create({
      data: {
        createdById: student.id,
        subject: 'Need help',
        message: 'Please assist',
      },
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${student.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: student.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('support ticket')
  })

  it('blocks deleting a student with ticket replies', async () => {
    const admin = await createUser({ email: 'admin@delete-ticket-reply.test', role: 'ADMIN' })
    const university = await createUniversity('Delete Ticket Reply University')
    const student = await createUser({
      email: 'student@delete-ticket-reply.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const ticket = await prisma.supportTicket.create({
      data: {
        createdById: admin.id,
        subject: 'Help',
        message: 'Initial ticket',
      },
    })

    await prisma.supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        authorId: student.id,
        message: 'Reply message',
      },
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/users/${student.id}/delete`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUser(req, { params: Promise.resolve({ id: student.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('support ticket')
  })
})

describe('admin supervisor management', () => {
  it('updates supervisor details and syncs pending join-request email references', async () => {
    const admin = await createUser({ email: 'admin@supervisor-edit.test', role: 'ADMIN' })
    const university = await createUniversity('Supervisor Edit University')
    const supervisor = await createUser({
      email: 'supervisor@supervisor-edit.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@supervisor-edit.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await prisma.joinRequest.create({
      data: {
        studentId: student.id,
        supervisorId: supervisor.id,
        supervisorEmailEntered: supervisor.email,
        status: 'PENDING',
      },
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/supervisors/${supervisor.id}`, {
      method: 'PATCH',
      body: {
        firstName: 'Renamed',
        lastName: 'Supervisor',
        email: 'renamed@supervisor-edit.test',
        universityId: university.id,
      },
    })

    const res = await patchAdminSupervisor(req, { params: Promise.resolve({ id: supervisor.id }) })
    expect(res.status).toBe(200)

    const updatedSupervisor = await prisma.user.findUnique({ where: { id: supervisor.id } })
    expect(updatedSupervisor?.email).toBe('renamed@supervisor-edit.test')

    const joinRequest = await prisma.joinRequest.findFirst({
      where: { studentId: student.id },
    })
    expect(joinRequest?.supervisorEmailEntered).toBe('renamed@supervisor-edit.test')
  })

  it('blocks supervisor deactivation while teams are still assigned', async () => {
    const admin = await createUser({ email: 'admin@supervisor-status.test', role: 'ADMIN' })
    const university = await createUniversity('Supervisor Status University')
    const supervisor = await createUser({
      email: 'supervisor@supervisor-status.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })

    await createTeam({
      name: 'Assigned Team',
      supervisorId: supervisor.id,
      universityId: university.id,
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/supervisors/${supervisor.id}/status`, {
      method: 'PATCH',
      body: { isActive: false },
    })

    const res = await patchAdminSupervisorStatus(req, {
      params: Promise.resolve({ id: supervisor.id }),
    })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toContain('Supervisor cannot be deactivated')
  })

  it('reactivates an inactive supervisor when they have no assigned teams', async () => {
    const admin = await createUser({ email: 'admin@supervisor-reactivate.test', role: 'ADMIN' })
    const university = await createUniversity('Supervisor Reactivate University')
    const supervisor = await createUser({
      email: 'supervisor@supervisor-reactivate.test',
      role: 'SUPERVISOR',
      universityId: university.id,
      isActive: false,
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/supervisors/${supervisor.id}/status`, {
      method: 'PATCH',
      body: { isActive: true },
    })

    const res = await patchAdminSupervisorStatus(req, {
      params: Promise.resolve({ id: supervisor.id }),
    })
    expect(res.status).toBe(200)

    const updatedSupervisor = await prisma.user.findUnique({ where: { id: supervisor.id } })
    expect(updatedSupervisor?.isActive).toBe(true)
  })
})

describe('supervisor student management', () => {
  it('lists same-university students, creates students in the supervisor university, and blocks cross-university or higher-role edits', async () => {
    const universityA = await createUniversity('Supervisor Scope University A')
    const universityB = await createUniversity('Supervisor Scope University B')
    const supervisor = await createUser({
      email: 'supervisor@supervisor-scope.test',
      role: 'SUPERVISOR',
      universityId: universityA.id,
    })
    const visibleStudent = await createUser({
      email: 'visible@supervisor-scope.test',
      role: 'STUDENT',
      universityId: universityA.id,
    })
    const hiddenStudent = await createUser({
      email: 'hidden@supervisor-scope.test',
      role: 'STUDENT',
      universityId: universityB.id,
    })
    const sameUniversitySupervisor = await createUser({
      email: 'other-supervisor@supervisor-scope.test',
      role: 'SUPERVISOR',
      universityId: universityA.id,
    })

    await loginAs(supervisor.id)

    const listRes = await getSupervisorStudents()
    expect(listRes.status).toBe(200)

    const listData = await listRes.json()
    expect(listData.students).toHaveLength(1)
    expect(listData.students[0].id).toBe(visibleStudent.id)

    const createReq = makeRequest(`${BASE}/api/supervisor/students`, {
      method: 'POST',
      body: {
        firstName: 'Scoped',
        lastName: 'Student',
        email: 'created@supervisor-scope.test',
      },
    })

    const createRes = await postSupervisorStudents(createReq)
    expect(createRes.status).toBe(201)

    const createdStudent = await prisma.user.findUnique({
      where: { email: 'created@supervisor-scope.test' },
    })
    expect(createdStudent?.role).toBe('STUDENT')
    expect(createdStudent?.universityId).toBe(universityA.id)

    const blockedUniversityReq = makeRequest(`${BASE}/api/supervisor/students/${hiddenStudent.id}`, {
      method: 'PATCH',
      body: {
        firstName: 'Blocked',
        lastName: 'Student',
        email: hiddenStudent.email,
      },
    })

    const blockedUniversityRes = await patchSupervisorStudent(blockedUniversityReq, {
      params: Promise.resolve({ id: hiddenStudent.id }),
    })
    expect(blockedUniversityRes.status).toBe(403)

    const blockedRoleReq = makeRequest(`${BASE}/api/supervisor/students/${sameUniversitySupervisor.id}`, {
      method: 'PATCH',
      body: {
        firstName: 'Nope',
        lastName: 'Supervisor',
        email: sameUniversitySupervisor.email,
      },
    })

    const blockedRoleRes = await patchSupervisorStudent(blockedRoleReq, {
      params: Promise.resolve({ id: sameUniversitySupervisor.id }),
    })
    expect(blockedRoleRes.status).toBe(404)
  })
})
