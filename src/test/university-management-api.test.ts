import { describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import { createTeam, createUniversity, createUser } from './fixtures'

import { GET as getAdminUniversities } from '@/app/api/admin/universities/route'
import { DELETE as deleteAdminUniversity } from '@/app/api/admin/universities/[id]/route'

const BASE = 'http://localhost:5000'

describe('admin university cleanup APIs', () => {
  it('lists delete eligibility for empty and linked universities', async () => {
    const admin = await createUser({ email: 'admin@university-cleanup.test', role: 'ADMIN' })
    const emptyUniversity = await createUniversity('Cleanup Empty University')
    const usersUniversity = await createUniversity('Cleanup Users University')
    const teamsUniversity = await createUniversity('Cleanup Teams University')
    const supervisorUniversity = await createUniversity('Cleanup Supervisor University')

    const supervisor = await createUser({
      email: 'supervisor@university-cleanup.test',
      role: 'SUPERVISOR',
      universityId: supervisorUniversity.id,
    })

    await createUser({
      email: 'student@university-cleanup.test',
      role: 'STUDENT',
      universityId: usersUniversity.id,
    })

    await createTeam({
      name: 'Cleanup Team',
      supervisorId: supervisor.id,
      universityId: teamsUniversity.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)

    const res = await getAdminUniversities()
    expect(res.status).toBe(200)

    const data = await res.json()
    const emptyRow = data.universities.find((university: { id: string }) => university.id === emptyUniversity.id)
    const usersRow = data.universities.find((university: { id: string }) => university.id === usersUniversity.id)
    const teamsRow = data.universities.find((university: { id: string }) => university.id === teamsUniversity.id)

    expect(emptyRow.canDelete).toBe(true)
    expect(emptyRow.deleteBlockedReason).toBeNull()
    expect(usersRow.canDelete).toBe(false)
    expect(usersRow.deleteBlockedReason).toBe(
      'Universities with linked users cannot be deleted. Move or remove those users first.'
    )
    expect(teamsRow.canDelete).toBe(false)
    expect(teamsRow.deleteBlockedReason).toBe(
      'Universities with linked teams cannot be deleted. Keep the university for history or move those teams first.'
    )
  })

  it('deletes an empty university', async () => {
    const admin = await createUser({ email: 'admin@university-delete-empty.test', role: 'ADMIN' })
    const university = await createUniversity('University Delete Empty')

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/universities/${university.id}`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUniversity(req, { params: Promise.resolve({ id: university.id }) })
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.message).toBe('University deleted successfully')

    const deletedUniversity = await prisma.university.findUnique({
      where: { id: university.id },
    })
    expect(deletedUniversity).toBeNull()
  })

  it('blocks deleting a university with linked users', async () => {
    const admin = await createUser({ email: 'admin@university-delete-users.test', role: 'ADMIN' })
    const university = await createUniversity('University Delete Users')

    await createUser({
      email: 'student@university-delete-users.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/universities/${university.id}`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUniversity(req, { params: Promise.resolve({ id: university.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toBe('Universities with linked users cannot be deleted. Move or remove those users first.')

    const preservedUniversity = await prisma.university.findUnique({
      where: { id: university.id },
    })
    expect(preservedUniversity).not.toBeNull()
  })

  it('blocks deleting a university with linked teams', async () => {
    const admin = await createUser({ email: 'admin@university-delete-teams.test', role: 'ADMIN' })
    const university = await createUniversity('University Delete Teams')
    const supervisorUniversity = await createUniversity('University Delete Teams Supervisor')
    const supervisor = await createUser({
      email: 'supervisor@university-delete-teams.test',
      role: 'SUPERVISOR',
      universityId: supervisorUniversity.id,
    })

    await createTeam({
      name: 'University Delete Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)

    const req = makeRequest(`${BASE}/api/admin/universities/${university.id}`, {
      method: 'DELETE',
    })

    const res = await deleteAdminUniversity(req, { params: Promise.resolve({ id: university.id }) })
    expect(res.status).toBe(422)

    const data = await res.json()
    expect(data.message).toBe(
      'Universities with linked teams cannot be deleted. Keep the university for history or move those teams first.'
    )

    const preservedUniversity = await prisma.university.findUnique({
      where: { id: university.id },
    })
    expect(preservedUniversity).not.toBeNull()
  })
})
