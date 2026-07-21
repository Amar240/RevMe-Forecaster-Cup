import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import { addTeamMember, createSeasonWithRounds, createTeam, createUniversity, createUser } from './fixtures'

const email = vi.hoisted(() => ({ activation: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/email', async () => {
  const actual = await vi.importActual<typeof import('@/lib/email')>('@/lib/email')
  return { ...actual, sendAccountActivationEmail: email.activation }
})
import { POST as processApproval, GET as getPending } from '@/app/api/admin/teams/pending/route'

describe('roster import approval', () => {
  beforeEach(() => email.activation.mockClear())

  async function setupBatch() {
    const university = await createUniversity('Approval University')
    const { season } = await createSeasonWithRounds({ name: 'Approval Season' })
    const supervisor = await createUser({ email: 'approval-supervisor@test.edu', role: 'SUPERVISOR', universityId: university.id })
    const admin = await createUser({ email: 'approval-admin@test.edu', role: 'ADMIN', universityId: university.id })
    const student = await createUser({ email: 'provisioned-student@test.edu', role: 'STUDENT', firstName: 'New', lastName: 'Student', universityId: university.id, emailVerified: false })
    const batch = await prisma.importBatch.create({ data: { uploaderId: supervisor.id, uploaderRole: 'SUPERVISOR', seasonId: season.id, universityId: university.id, fileName: 'roster.xlsx', fileHash: 'hash', status: 'CONFIRMED', summaryJson: {} } })
    const team = await createTeam({ name: 'Pending imported team', externalTeamId: 'approval-1', supervisorId: supervisor.id, universityId: university.id, seasonId: season.id, status: 'PENDING_APPROVAL' })
    await prisma.team.update({ where: { id: team.id }, data: { importBatchId: batch.id } })
    await addTeamMember(team.id, student.id, true)
    await prisma.importBatch.update({ where: { id: batch.id }, data: { summaryJson: { provisionedByTeam: { [team.id]: [student.id] } } } })
    return { admin, supervisor, student, batch, team }
  }

  it('groups pending teams by batch and approves with one deferred email', async () => {
    const { admin, student, batch, team } = await setupBatch()
    await loginAs(admin.id)
    const pendingResponse = await getPending()
    const pending = await pendingResponse.json()
    expect(pending.groups).toHaveLength(1)
    expect(pending.groups[0].teams[0].id).toBe(team.id)

    const response = await processApproval(makeRequest('http://localhost/api/admin/teams/pending', { method: 'POST', body: { action: 'approve-batch', batchId: batch.id } }))
    expect(response.status).toBe(200)
    expect(await prisma.team.findUnique({ where: { id: team.id } })).toMatchObject({ status: 'ACTIVE', approvedById: admin.id })
    expect(await prisma.importBatch.findUnique({ where: { id: batch.id } })).toMatchObject({ status: 'COMPLETED' })
    expect((await prisma.user.findUnique({ where: { id: student.id } }))?.resetToken).toBeTruthy()
    expect(email.activation).toHaveBeenCalledTimes(1)
    expect(await prisma.emailDispatch.count({ where: { type: 'ROSTER_IMPORT_WELCOME', recipientId: student.id, teamId: team.id } })).toBe(1)
    expect(await prisma.auditLog.count({ where: { action: { in: ['TEAM_APPROVED', 'IMPORT_BATCH_APPROVED'] } } })).toBe(2)
  })

  it('rejects with supervisor notification and no student email', async () => {
    const { admin, supervisor, student, batch, team } = await setupBatch()
    await loginAs(admin.id)
    const response = await processApproval(makeRequest('http://localhost/api/admin/teams/pending', { method: 'POST', body: { action: 'reject', teamId: team.id, reason: 'Roster details need correction' } }))
    expect(response.status).toBe(200)
    expect(await prisma.team.findUnique({ where: { id: team.id } })).toMatchObject({ status: 'REJECTED', rejectionReason: 'Roster details need correction' })
    expect(await prisma.importBatch.findUnique({ where: { id: batch.id } })).toMatchObject({ status: 'COMPLETED' })
    expect(await prisma.notification.findFirst({ where: { userId: supervisor.id, type: 'TEAM_REJECTED' } })).toMatchObject({ message: 'Roster details need correction' })
    expect(await prisma.emailDispatch.count({ where: { recipientId: student.id } })).toBe(0)
    expect(email.activation).not.toHaveBeenCalled()
    expect(await prisma.auditLog.count({ where: { action: 'TEAM_REJECTED', entityId: team.id } })).toBe(1)
  })
})
