import { describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import { addTeamMember, createTeam, createUniversity, createUser } from './fixtures'

import { POST as registerHandler } from '@/app/api/auth/register/route'
import { GET as getPublicUniversities } from '@/app/api/universities/route'
import { GET as getAdminUniversities } from '@/app/api/admin/universities/route'
import { POST as approveUniversity } from '@/app/api/admin/universities/[id]/approve/route'
import { POST as syncUniversity } from '@/app/api/admin/universities/[id]/sync/route'

const BASE = 'http://localhost:5000'

describe('university review queue', () => {
  it('registering with EXISTING mode links user to the listed university without creating a new one', async () => {
    const listed = await createUniversity('Listed University')

    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'existing-mode@test.com',
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'Mode',
        role: 'STUDENT',
        universitySelectionMode: 'EXISTING',
        universityConfirmed: true,
        universityId: listed.id,
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(201)

    const user = await prisma.user.findUnique({
      where: { email: 'existing-mode@test.com' },
    })

    expect(user?.universityId).toBe(listed.id)
    expect(await prisma.university.count()).toBe(1)
  })

  it('registering with OTHER mode creates a hidden pending university', async () => {
    const req = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'other-mode@test.com',
        password: 'Password123!',
        firstName: 'Other',
        lastName: 'Mode',
        role: 'STUDENT',
        universitySelectionMode: 'OTHER',
        universityConfirmed: true,
        confirmedNoMatchingUniversity: true,
        universityName: 'Pending University',
        country: 'India',
      },
    })

    const res = await registerHandler(req)
    expect(res.status).toBe(201)

    const university = await prisma.university.findUnique({
      where: { name: 'Pending University' },
    })

    expect(university?.isListed).toBe(false)

    const user = await prisma.user.findUnique({
      where: { email: 'other-mode@test.com' },
    })

    expect(user?.universityId).toBe(university?.id)
  })

  it('public universities route does not return pending universities', async () => {
    const listed = await createUniversity('Listed University')
    await createUniversity('Pending University', { isListed: false })

    const req = makeRequest(`${BASE}/api/universities`)
    const res = await getPublicUniversities(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.universities).toEqual([{ id: listed.id, name: listed.name, country: listed.country, normalizedName: listed.normalizedName }])
  })

  it('a second OTHER registration with the same name reuses the existing pending university', async () => {
    const firstReq = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'pending-one@test.com',
        password: 'Password123!',
        firstName: 'Pending',
        lastName: 'One',
        role: 'STUDENT',
        universitySelectionMode: 'OTHER',
        universityConfirmed: true,
        confirmedNoMatchingUniversity: true,
        universityName: 'Shared Pending University',
        country: 'United States',
      },
    })

    const secondReq = makeRequest(`${BASE}/api/auth/register`, {
      method: 'POST',
      body: {
        email: 'pending-two@test.com',
        password: 'Password123!',
        firstName: 'Pending',
        lastName: 'Two',
        role: 'SUPERVISOR',
        universitySelectionMode: 'OTHER',
        universityConfirmed: true,
        confirmedNoMatchingUniversity: true,
        universityName: '  shared   pending university  ',
        country: 'United States',
      },
    })

    expect((await registerHandler(firstReq)).status).toBe(201)
    expect((await registerHandler(secondReq)).status).toBe(201)

    const universities = await prisma.university.findMany({
      where: { normalizedName: 'shared pending university' },
    })

    expect(universities).toHaveLength(1)

    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['pending-one@test.com', 'pending-two@test.com'],
        },
      },
      orderBy: { email: 'asc' },
    })

    expect(users[0].universityId).toBe(universities[0].id)
    expect(users[1].universityId).toBe(universities[0].id)
  })

  it('admin list includes both listed and pending universities with isListed field', async () => {
    const admin = await createUser({ email: 'admin@university-review.test', role: 'ADMIN' })
    const listed = await createUniversity('Listed University')
    const pending = await createUniversity('Pending University', { isListed: false })

    await loginAs(admin.id)

    const res = await getAdminUniversities()
    expect(res.status).toBe(200)

    const data = await res.json()
    const listedRow = data.universities.find((university: { id: string }) => university.id === listed.id)
    const pendingRow = data.universities.find((university: { id: string }) => university.id === pending.id)

    expect(listedRow.isListed).toBe(true)
    expect(pendingRow.isListed).toBe(false)
  })

  it('admin approve sets isListed to true and the university appears in the public list', async () => {
    const admin = await createUser({ email: 'admin@approve-university.test', role: 'ADMIN' })
    const pending = await createUniversity('Pending Approval University', { isListed: false })

    await loginAs(admin.id)

    const approveReq = makeRequest(`${BASE}/api/admin/universities/${pending.id}/approve`, {
      method: 'POST',
    })

    const approveRes = await approveUniversity(approveReq, { params: Promise.resolve({ id: pending.id }) })
    expect(approveRes.status).toBe(200)

    const approved = await prisma.university.findUnique({
      where: { id: pending.id },
    })
    expect(approved?.isListed).toBe(true)

    const publicReq = makeRequest(`${BASE}/api/universities`)
    const publicRes = await getPublicUniversities(publicReq)
    const publicData = await publicRes.json()

    expect(publicData.universities).toEqual([{ id: pending.id, name: 'Pending Approval University', country: pending.country, normalizedName: pending.normalizedName }])
  })

  it('admin sync moves linked users and teams to the listed target and removes the pending source when empty', async () => {
    const admin = await createUser({ email: 'admin@sync-university.test', role: 'ADMIN' })
    const listed = await createUniversity('Canonical University')
    const pending = await createUniversity('Pending University', { isListed: false })
    const supervisor = await createUser({
      email: 'supervisor@sync-university.test',
      role: 'SUPERVISOR',
      universityId: pending.id,
    })
    const student = await createUser({
      email: 'student@sync-university.test',
      role: 'STUDENT',
      universityId: pending.id,
    })
    const team = await createTeam({
      name: 'Pending University Team',
      supervisorId: supervisor.id,
      universityId: pending.id,
    })

    await addTeamMember(team.id, student.id, true)
    await loginAs(admin.id)

    const syncReq = makeRequest(`${BASE}/api/admin/universities/${pending.id}/sync`, {
      method: 'POST',
      body: { targetUniversityId: listed.id },
    })

    const syncRes = await syncUniversity(syncReq, { params: Promise.resolve({ id: pending.id }) })
    expect(syncRes.status).toBe(200)

    const data = await syncRes.json()
    expect(data).toEqual({ merged: true, deletedSource: true })

    const [updatedSupervisor, updatedStudent, updatedTeam, deletedPending] = await Promise.all([
      prisma.user.findUnique({ where: { id: supervisor.id } }),
      prisma.user.findUnique({ where: { id: student.id } }),
      prisma.team.findUnique({ where: { id: team.id } }),
      prisma.university.findUnique({ where: { id: pending.id } }),
    ])

    expect(updatedSupervisor?.universityId).toBe(listed.id)
    expect(updatedStudent?.universityId).toBe(listed.id)
    expect(updatedTeam?.universityId).toBe(listed.id)
    expect(deletedPending).toBeNull()
  })
})
