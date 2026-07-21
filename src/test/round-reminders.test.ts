import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from './db'
import { addTeamMember, createSeasonWithRounds, createTeam, createUniversity, createUser } from './fixtures'

const email = vi.hoisted(() => ({ sendRoundOpenEmail: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/email', () => ({ sendRoundOpenEmail: email.sendRoundOpenEmail }))
import { processDeadlineReminders } from '@/server/round-reminders'

describe('automatic deadline reminders', () => {
  let now: Date
  let roundId: string
  let studentId: string

  beforeEach(async () => {
    email.sendRoundOpenEmail.mockClear()
    now = new Date('2026-08-03T12:00:00.000Z')
    const university = await createUniversity('Reminder University')
    const { season, rounds } = await createSeasonWithRounds({ name: 'Reminder Season', startDate: new Date('2026-08-01T12:00:00.000Z') })
    roundId = rounds[0].id
    await prisma.round.updateMany({ where: { seasonId: season.id, id: { not: roundId } }, data: { status: 'UPCOMING' } })
    await prisma.round.update({ where: { id: roundId }, data: { status: 'OPEN', opensAt: new Date(now.getTime() - 3_600_000), closesAt: new Date(now.getTime() + 47 * 3_600_000) } })
    const supervisor = await createUser({ email: 'supervisor@reminder.test', role: 'SUPERVISOR', universityId: university.id })
    const student = await createUser({ email: 'student@reminder.test', role: 'STUDENT', universityId: university.id })
    studentId = student.id
    const team = await createTeam({ supervisorId: supervisor.id, universityId: university.id, seasonId: season.id })
    await addTeamMember(team.id, student.id, true)
  })

  it('deduplicates the 48-hour and 24-hour reminder buckets independently', async () => {
    expect(await processDeadlineReminders(now)).toMatchObject({ notificationsCreated: 1, emailsSent: 1 })
    expect(await processDeadlineReminders(now)).toMatchObject({ notificationsCreated: 0, emailsSent: 0 })
    const later = new Date(now.getTime() + 24 * 3_600_000)
    expect(await processDeadlineReminders(later)).toMatchObject({ notificationsCreated: 1, emailsSent: 1 })
    expect(await prisma.notification.count({ where: { userId: studentId, link: `/submit?roundId=${roundId}` } })).toBe(2)
    expect(await prisma.emailDispatch.count({ where: { recipientId: studentId, roundId, success: true } })).toBe(2)
  })

  it('does not remind a team that already submitted', async () => {
    const membership = await prisma.teamMember.findFirstOrThrow({ where: { userId: studentId } })
    await prisma.submission.create({ data: { teamId: membership.teamId, roundId, submittedById: studentId, locked: true } })
    expect(await processDeadlineReminders(now)).toMatchObject({ notificationsCreated: 0, emailsSent: 0 })
  })
})
