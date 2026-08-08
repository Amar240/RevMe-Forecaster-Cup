import type { Prisma, User } from '@prisma/client'
import { buildAuditLogData } from '@/lib/audit'
import { ApiError } from '@/server/http'
import { resolveAssignableSupervisor } from '@/server/team-management'
import {
  isCurrentSupervisorResponsibility,
  transitionSupervisorAssignment,
} from '@/server/team-supervisor-assignment'

type ChangeActor = Pick<User, 'id' | 'email' | 'role'>

const changeTeamSelect = {
  id: true,
  name: true,
  displayId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  seasonId: true,
  universityId: true,
  university: {
    select: { id: true, name: true, normalizedName: true },
  },
  season: {
    select: { id: true, name: true, status: true },
  },
  supervisorId: true,
  supervisor: {
    select: { id: true, email: true, firstName: true, lastName: true },
  },
  members: {
    select: { userId: true },
  },
} satisfies Prisma.TeamSelect

export async function changeTeamSupervisorInTransaction(args: {
  tx: Prisma.TransactionClient
  actor: ChangeActor
  teamId: string
  supervisorId: string | null
  reason: string
  expectedUpdatedAt?: Date
}) {
  const reason = args.reason.trim().replace(/\s+/g, ' ')
  if (reason.length < 5 || reason.length > 500) {
    throw new ApiError('Reason must be between 5 and 500 characters.', 400, 'INVALID_INPUT')
  }

  const team = await args.tx.team.findUnique({
    where: { id: args.teamId },
    select: changeTeamSelect,
  })

  if (!team) throw new ApiError('Team not found', 404, 'NOT_FOUND')
  if (args.expectedUpdatedAt && team.updatedAt.getTime() !== args.expectedUpdatedAt.getTime()) {
    throw new ApiError(
      'This team changed after you opened it. Refresh and review the latest assignment before trying again.',
      409,
      'CONFLICT'
    )
  }
  if (!isCurrentSupervisorResponsibility(team)) {
    throw new ApiError(
      'Completed, archived, rejected, and disqualified team assignments are historical and cannot be changed.',
      422,
      'INVALID_INPUT'
    )
  }
  if (team.supervisorId === args.supervisorId) return team

  const nextSupervisor = args.supervisorId
    ? await resolveAssignableSupervisor({
        supervisorId: args.supervisorId,
        university: team.university,
        seasonId: team.seasonId,
        teamIdToExclude: team.id,
        db: args.tx,
      })
    : null

  const changedAt = new Date()
  await transitionSupervisorAssignment({
    teamId: team.id,
    previousSupervisorId: team.supervisorId,
    nextSupervisorId: nextSupervisor?.id ?? null,
    actorId: args.actor.id,
    reason,
    teamCreatedAt: team.createdAt,
    changedAt,
    db: args.tx,
  })

  await args.tx.team.update({
    where: { id: team.id },
    data: { supervisorId: nextSupervisor?.id ?? null },
  })

  await args.tx.joinRequest.updateMany({
    where: { teamId: team.id, status: 'PENDING' },
    data: {
      supervisorId: nextSupervisor?.id ?? null,
      supervisorEmailEntered: nextSupervisor?.email ?? null,
    },
  })

  const unresolvedTicketWhere: Prisma.SupportTicketWhereInput = {
    teamId: team.id,
    status: { not: 'RESOLVED' },
  }
  if (team.supervisorId) {
    await args.tx.supportTicket.updateMany({
      where: { ...unresolvedTicketWhere, assignedToId: team.supervisorId },
      data: { assignedToId: nextSupervisor?.id ?? null },
    })
  }
  await args.tx.supportTicket.updateMany({
    where: unresolvedTicketWhere,
    data: { supervisorId: nextSupervisor?.id ?? null },
  })

  const notificationData: Prisma.NotificationCreateManyInput[] = []
  if (team.supervisorId) {
    notificationData.push({
      userId: team.supervisorId,
      type: 'TEAM_SUPERVISOR_REMOVED',
      title: `Assignment changed for ${team.name}`,
      message: nextSupervisor
        ? `${team.name} is now assigned to ${nextSupervisor.firstName} ${nextSupervisor.lastName}.`
        : `${team.name} is temporarily unassigned.`,
      link: '/dashboard',
      createdAt: changedAt,
    })
  }
  if (nextSupervisor) {
    notificationData.push({
      userId: nextSupervisor.id,
      type: 'TEAM_SUPERVISOR_ASSIGNED',
      title: `You are now advising ${team.name}`,
      message: `An administrator assigned ${team.name} to you.`,
      link: '/dashboard',
      createdAt: changedAt,
    })
  }
  if (team.status === 'ACTIVE') {
    for (const member of team.members) {
      notificationData.push({
        userId: member.userId,
        type: 'TEAM_SUPERVISOR_CHANGED',
        title: `Advisor update for ${team.name}`,
        message: nextSupervisor
          ? `${nextSupervisor.firstName} ${nextSupervisor.lastName} is now your team advisor.`
          : 'Your team is temporarily without an advisor. You can continue submitting forecasts while an administrator assigns one.',
        link: '/dashboard',
        createdAt: changedAt,
      })
    }
  }
  if (notificationData.length > 0) {
    await args.tx.notification.createMany({ data: notificationData })
  }

  await args.tx.auditLog.create({
    data: buildAuditLogData(
      args.actor,
      nextSupervisor ? 'TEAM_SUPERVISOR_CHANGED' : 'TEAM_SUPERVISOR_UNASSIGNED',
      'Team',
      team.id,
      {
        details: {
          reason,
          previousSupervisorId: team.supervisorId,
          previousSupervisorEmail: team.supervisor?.email ?? null,
          nextSupervisorId: nextSupervisor?.id ?? null,
          nextSupervisorEmail: nextSupervisor?.email ?? null,
        },
        before: {
          supervisorId: team.supervisorId,
          supervisorEmail: team.supervisor?.email ?? null,
        },
        after: {
          supervisorId: nextSupervisor?.id ?? null,
          supervisorEmail: nextSupervisor?.email ?? null,
        },
      }
    ),
  })

  return {
    ...team,
    supervisorId: nextSupervisor?.id ?? null,
    supervisor: nextSupervisor,
    updatedAt: changedAt,
  }
}
