import { beforeEach, describe, expect, it } from 'vitest'
import { loginAs, logout } from './auth'
import { prisma } from './db'
import { createTeam, createUser } from './fixtures'
import { makeRequest } from './http'

import { GET as getSupportTickets, POST as postSupportTickets } from '@/app/api/support-tickets/route'
import {
  GET as getSupportTicketById,
  POST as postSupportTicketById,
} from '@/app/api/support-tickets/[id]/route'

describe('Support Tickets API', () => {
  let university: Awaited<ReturnType<typeof prisma.university.create>>
  let season: Awaited<ReturnType<typeof prisma.season.create>>
  let admin: Awaited<ReturnType<typeof createUser>>
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let student: Awaited<ReturnType<typeof createUser>>
  let team: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await prisma.university.create({
      data: {
        name: 'Support Test University',
      },
    })

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

    season = await prisma.season.create({
      data: {
        name: 'Support Test Season',
        status: 'ACTIVE',
        startDate,
        endDate,
        registrationOpen: true,
      },
    })

    admin = await createUser({
      email: 'admin@support.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    supervisor = await createUser({
      email: 'supervisor@support.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    student = await createUser({
      email: 'student@support.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    team = await createTeam({
      name: 'Support Test Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: student.id,
      },
    })
  })

  it('student can create a ticket', async () => {
    await loginAs(student.id)

    const res = await postSupportTickets(
      makeRequest('http://localhost/api/support-tickets', {
        method: 'POST',
        body: {
          subject: 'Need help with my team',
          message: 'Please review my access.',
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ticket.createdById).toBe(student.id)
    expect(data.ticket.teamId).toBe(team.id)
    expect(data.ticket.supervisorId).toBe(supervisor.id)
    expect(data.ticket.status).toBe('WAITING_ON_SUPERVISOR')

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: data.ticket.id },
    })

    expect(ticket?.createdById).toBe(student.id)
    expect(ticket?.teamId).toBe(team.id)
    expect(ticket?.supervisorId).toBe(supervisor.id)
    expect(ticket?.status).toBe('WAITING_ON_SUPERVISOR')
  })

  it('missing required fields returns 400', async () => {
    await loginAs(student.id)

    const res = await postSupportTickets(
      makeRequest('http://localhost/api/support-tickets', {
        method: 'POST',
        body: {
          subject: 'Missing message',
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.message).toBe('Subject and message are required')
  })

  it('student can view their own tickets', async () => {
    const ticket = await prisma.supportTicket.create({
      data: {
        createdById: student.id,
        seasonId: season.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        subject: 'My ticket',
        message: 'I need help.',
        status: 'WAITING_ON_SUPERVISOR',
      },
    })

    await loginAs(student.id)

    const res = await getSupportTickets(makeRequest('http://localhost/api/support-tickets'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tickets).toHaveLength(1)
    expect(data.tickets[0].id).toBe(ticket.id)
  })

  it("student cannot view another student's tickets", async () => {
    const otherStudent = await createUser({
      email: 'other-student@support.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: otherStudent.id,
      },
    })

    const otherTicket = await prisma.supportTicket.create({
      data: {
        createdById: otherStudent.id,
        seasonId: season.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        subject: 'Another student ticket',
        message: 'Private ticket',
        status: 'WAITING_ON_SUPERVISOR',
      },
    })

    await loginAs(student.id)

    const res = await getSupportTicketById(
      makeRequest(`http://localhost/api/support-tickets/${otherTicket.id}`),
      { params: Promise.resolve({ id: otherTicket.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(403)
    expect(data.message).toBe('Unauthorized')
  })

  it('supervisor can view tickets linked to their teams', async () => {
    const visibleTicket = await prisma.supportTicket.create({
      data: {
        createdById: student.id,
        seasonId: season.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        subject: 'Visible ticket',
        message: 'Supervisor should see this.',
        status: 'WAITING_ON_SUPERVISOR',
      },
    })

    const otherSupervisor = await createUser({
      email: 'other-supervisor@support.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const otherTeam = await createTeam({
      name: 'Other Support Team',
      supervisorId: otherSupervisor.id,
      universityId: university.id,
      seasonId: season.id,
    })
    const otherStudent = await createUser({
      email: 'other-team-student@support.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    await prisma.teamMember.create({
      data: {
        teamId: otherTeam.id,
        userId: otherStudent.id,
      },
    })

    await prisma.supportTicket.create({
      data: {
        createdById: otherStudent.id,
        seasonId: season.id,
        teamId: otherTeam.id,
        supervisorId: otherSupervisor.id,
        subject: 'Hidden ticket',
        message: 'Supervisor should not see this.',
        status: 'WAITING_ON_SUPERVISOR',
      },
    })

    await loginAs(supervisor.id)

    const res = await getSupportTickets(makeRequest('http://localhost/api/support-tickets?view=inbox'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tickets).toHaveLength(1)
    expect(data.tickets[0].id).toBe(visibleTicket.id)
  })

  it('admin can view all tickets', async () => {
    const otherStudent = await createUser({
      email: 'all-tickets-student@support.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const firstTicket = await prisma.supportTicket.create({
      data: {
        createdById: student.id,
        seasonId: season.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        subject: 'First ticket',
        message: 'First message',
      },
    })

    const secondTicket = await prisma.supportTicket.create({
      data: {
        createdById: otherStudent.id,
        seasonId: season.id,
        subject: 'Second ticket',
        message: 'Second message',
      },
    })

    await loginAs(admin.id)

    const res = await getSupportTickets(makeRequest('http://localhost/api/support-tickets'))
    const data = await res.json()

    expect(res.status).toBe(200)
    const ticketIds = data.tickets.map((ticket: { id: string }) => ticket.id)
    expect(ticketIds).toContain(firstTicket.id)
    expect(ticketIds).toContain(secondTicket.id)
  })

  it('admin can reply to a ticket', async () => {
    const ticket = await prisma.supportTicket.create({
      data: {
        createdById: student.id,
        seasonId: season.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        subject: 'Reply ticket',
        message: 'Awaiting admin response',
        status: 'WAITING_ON_SUPERVISOR',
      },
    })

    await loginAs(admin.id)

    const res = await postSupportTicketById(
      makeRequest(`http://localhost/api/support-tickets/${ticket.id}`, {
        method: 'POST',
        body: {
          action: 'reply',
          message: 'We are reviewing this now.',
        },
      }),
      { params: Promise.resolve({ id: ticket.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toBe('Reply added')

    const reply = await prisma.supportTicketReply.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
    })
    const updatedTicket = await prisma.supportTicket.findUnique({
      where: { id: ticket.id },
    })

    expect(reply?.authorId).toBe(admin.id)
    expect(reply?.visibility).toBe('STUDENT_VISIBLE')
    expect(updatedTicket?.status).toBe('WAITING_ON_STUDENT')
  })

  it('reply with INTERNAL_ONLY visibility is hidden from student', async () => {
    const ticket = await prisma.supportTicket.create({
      data: {
        createdById: student.id,
        seasonId: season.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        subject: 'Internal reply ticket',
        message: 'Student should not see internal note',
        status: 'WAITING_ON_SUPERVISOR',
      },
    })

    await loginAs(admin.id)

    const replyRes = await postSupportTicketById(
      makeRequest(`http://localhost/api/support-tickets/${ticket.id}`, {
        method: 'POST',
        body: {
          action: 'reply',
          message: 'Internal admin note',
          isInternal: true,
        },
      }),
      { params: Promise.resolve({ id: ticket.id }) }
    )

    expect(replyRes.status).toBe(200)

    const storedReply = await prisma.supportTicketReply.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'desc' },
    })

    expect(storedReply?.visibility).toBe('INTERNAL_ONLY')

    await loginAs(student.id)

    const res = await getSupportTicketById(
      makeRequest(`http://localhost/api/support-tickets/${ticket.id}`),
      { params: Promise.resolve({ id: ticket.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.ticket.replies).toHaveLength(0)
  })

  it('admin can change ticket status', async () => {
    const ticket = await prisma.supportTicket.create({
      data: {
        createdById: student.id,
        seasonId: season.id,
        teamId: team.id,
        supervisorId: supervisor.id,
        subject: 'Resolve ticket',
        message: 'Please resolve this issue',
        status: 'ESCALATED',
      },
    })

    await loginAs(admin.id)

    const res = await postSupportTicketById(
      makeRequest(`http://localhost/api/support-tickets/${ticket.id}`, {
        method: 'POST',
        body: {
          action: 'resolve',
        },
      }),
      { params: Promise.resolve({ id: ticket.id }) }
    )
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.message).toBe('Ticket resolved')

    const updatedTicket = await prisma.supportTicket.findUnique({
      where: { id: ticket.id },
    })

    expect(updatedTicket?.status).toBe('RESOLVED')
  })

  it('unauthenticated request is blocked', async () => {
    logout()

    const res = await getSupportTickets(makeRequest('http://localhost/api/support-tickets'))
    const data = await res.json()

    expect(res.status).toBe(401)
    expect(data.message).toBe('Unauthorized')
  })
})
