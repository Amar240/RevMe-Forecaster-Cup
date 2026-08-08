import crypto from 'crypto'
import { Prisma, type User } from '@prisma/client'
import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { getSupervisorTeamCountsForSeason } from '@/server/team-membership'
import { changeTeamSupervisorInTransaction } from '@/server/team-supervisor-change'
import { isCurrentSupervisorResponsibility } from '@/server/team-supervisor-assignment'

type DbClient = Prisma.TransactionClient | typeof prisma
type TransitionActor = Pick<User, 'id' | 'email' | 'role'>

export type SupervisorTransitionOperation = 'CHANGE_UNIVERSITY' | 'DEACTIVATE'
export type TeamTransitionResolution = {
  teamId: string
  action: 'REASSIGN' | 'UNASSIGN'
  supervisorId?: string | null
}
export type JoinRequestTransitionResolution = {
  joinRequestId: string
  action: 'REASSIGN' | 'CANCEL'
  supervisorId?: string | null
}
export type TicketTransitionResolution = {
  ticketId: string
  action: 'REASSIGN' | 'ESCALATE'
  supervisorId?: string | null
}

const transitionTeamSelect = {
  id: true,
  name: true,
  displayId: true,
  status: true,
  seasonId: true,
  supervisorId: true,
  updatedAt: true,
  university: { select: { id: true, name: true, normalizedName: true } },
  season: { select: { id: true, name: true, status: true } },
  _count: { select: { members: true } },
} satisfies Prisma.TeamSelect

const transitionRequestSelect = {
  id: true,
  teamId: true,
  supervisorId: true,
  supervisorEmailEntered: true,
  status: true,
  createdAt: true,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      universityId: true,
    },
  },
} satisfies Prisma.JoinRequestSelect

const transitionTicketSelect = {
  id: true,
  teamId: true,
  supervisorId: true,
  assignedToId: true,
  status: true,
  subject: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      universityId: true,
    },
  },
} satisfies Prisma.SupportTicketSelect

function requireFullAdmin(actor: TransitionActor) {
  if (actor.role !== 'ADMIN') {
    throw new ApiError('Only full administrators can manage supervisor transitions.', 403, 'FORBIDDEN')
  }
}

function stableFingerprint(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function getEligibleSupervisorsForTeam(
  team: Prisma.TeamGetPayload<{ select: typeof transitionTeamSelect }>,
  excludedSupervisorId: string,
  db: DbClient
) {
  const supervisors = await db.user.findMany({
    where: {
      role: 'SUPERVISOR',
      isActive: true,
      universityId: team.university.id,
      id: { not: excludedSupervisorId },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
  const counts = await getSupervisorTeamCountsForSeason({
    supervisorIds: supervisors.map((supervisor) => supervisor.id),
    seasonId: team.seasonId,
    db,
  })

  return supervisors
    .map((supervisor) => ({
      ...supervisor,
      currentTeamCount: counts.get(supervisor.id) ?? 0,
      remainingCapacity: Math.max(0, 10 - (counts.get(supervisor.id) ?? 0)),
    }))
    .filter((supervisor) => supervisor.remainingCapacity > 0)
}

async function getEligibleSupervisorsForUniversity(universityId: string | null, excludedId: string, db: DbClient) {
  if (!universityId) return []
  return db.user.findMany({
    where: {
      id: { not: excludedId },
      role: 'SUPERVISOR',
      isActive: true,
      universityId,
    },
    select: { id: true, firstName: true, lastName: true, email: true, universityId: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  })
}

async function buildPreflight(args: {
  supervisorId: string
  operation: SupervisorTransitionOperation
  targetUniversityId?: string | null
  db: DbClient
}) {
  const supervisor = await args.db.user.findUnique({
    where: { id: args.supervisorId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      universityId: true,
      updatedAt: true,
      university: { select: { id: true, name: true } },
    },
  })

  if (!supervisor || supervisor.role !== 'SUPERVISOR') {
    throw new ApiError('Supervisor not found', 404, 'NOT_FOUND')
  }

  let targetUniversity: { id: string; name: string } | null = null
  if (args.operation === 'CHANGE_UNIVERSITY') {
    if (!args.targetUniversityId) {
      throw new ApiError('Target university is required.', 400, 'INVALID_INPUT')
    }
    if (args.targetUniversityId === supervisor.universityId) {
      throw new ApiError('Select a different university.', 422, 'INVALID_INPUT')
    }
    targetUniversity = await args.db.university.findUnique({
      where: { id: args.targetUniversityId },
      select: { id: true, name: true },
    })
    if (!targetUniversity) throw new ApiError('Target university not found', 404, 'NOT_FOUND')
  }

  const teams = await args.db.team.findMany({
    where: { supervisorId: supervisor.id },
    select: transitionTeamSelect,
    orderBy: [{ season: { startDate: 'desc' } }, { name: 'asc' }],
  })
  const currentTeams = teams.filter(isCurrentSupervisorResponsibility)
  const historicalTeams = teams.filter((team) => !isCurrentSupervisorResponsibility(team))
  const currentTeamIds = new Set(currentTeams.map((team) => team.id))

  const [pendingRequests, unresolvedTickets] = await Promise.all([
    args.db.joinRequest.findMany({
      where: {
        status: 'PENDING',
        OR: [
          { supervisorId: supervisor.id },
          { supervisorEmailEntered: { equals: supervisor.email, mode: 'insensitive' } },
        ],
      },
      select: transitionRequestSelect,
      orderBy: { createdAt: 'asc' },
    }),
    args.db.supportTicket.findMany({
      where: {
        status: { not: 'RESOLVED' },
        OR: [{ supervisorId: supervisor.id }, { assignedToId: supervisor.id }],
      },
      select: transitionTicketSelect,
      orderBy: { updatedAt: 'asc' },
    }),
  ])

  const unrelatedRequests = pendingRequests.filter(
    (request) => !request.teamId || !currentTeamIds.has(request.teamId)
  )
  const unrelatedTickets = unresolvedTickets.filter(
    (ticket) => !ticket.teamId || !currentTeamIds.has(ticket.teamId)
  )

  const currentTeamsWithEligibility = await Promise.all(
    currentTeams.map(async (team) => ({
      ...team,
      eligibleSupervisors: await getEligibleSupervisorsForTeam(team, supervisor.id, args.db),
    }))
  )
  const eligibleUniversitySupervisors = await getEligibleSupervisorsForUniversity(
    supervisor.universityId,
    supervisor.id,
    args.db
  )

  const fingerprint = stableFingerprint({
    supervisor: {
      id: supervisor.id,
      universityId: supervisor.universityId,
      isActive: supervisor.isActive,
      updatedAt: supervisor.updatedAt.toISOString(),
    },
    teams: currentTeams.map((team) => ({
      id: team.id,
      supervisorId: team.supervisorId,
      status: team.status,
      updatedAt: team.updatedAt.toISOString(),
    })),
    requests: pendingRequests.map((request) => ({
      id: request.id,
      teamId: request.teamId,
      supervisorId: request.supervisorId,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    })),
    tickets: unresolvedTickets.map((ticket) => ({
      id: ticket.id,
      teamId: ticket.teamId,
      supervisorId: ticket.supervisorId,
      assignedToId: ticket.assignedToId,
      status: ticket.status,
      updatedAt: ticket.updatedAt.toISOString(),
    })),
  })

  return {
    supervisor,
    operation: args.operation,
    targetUniversity,
    currentTeams: currentTeamsWithEligibility,
    historicalTeams,
    unrelatedRequests,
    unrelatedTickets,
    automaticallyFollowing: {
      joinRequests: pendingRequests.length - unrelatedRequests.length,
      supportTickets: unresolvedTickets.length - unrelatedTickets.length,
    },
    eligibleUniversitySupervisors,
    fingerprint,
  }
}

export async function getSupervisorTransitionPreflight(args: {
  actor: TransitionActor
  supervisorId: string
  operation: SupervisorTransitionOperation
  targetUniversityId?: string | null
}) {
  requireFullAdmin(args.actor)
  return buildPreflight({ ...args, db: prisma })
}

function assertExactResolutionIds(requiredIds: string[], submittedIds: string[], label: string) {
  const uniqueSubmitted = new Set(submittedIds)
  if (
    uniqueSubmitted.size !== submittedIds.length ||
    requiredIds.length !== uniqueSubmitted.size ||
    requiredIds.some((id) => !uniqueSubmitted.has(id))
  ) {
    throw new ApiError(`Provide exactly one resolution for every ${label}.`, 422, 'INVALID_INPUT')
  }
}

async function requireResolutionSupervisor(args: {
  supervisorId?: string | null
  universityId: string | null
  excludedSupervisorId: string
  db: Prisma.TransactionClient
}) {
  if (!args.supervisorId) {
    throw new ApiError('Select a replacement supervisor.', 422, 'INVALID_INPUT')
  }
  const supervisor = await args.db.user.findUnique({
    where: { id: args.supervisorId },
    select: { id: true, email: true, role: true, isActive: true, universityId: true },
  })
  if (
    !supervisor ||
    supervisor.id === args.excludedSupervisorId ||
    supervisor.role !== 'SUPERVISOR' ||
    !supervisor.isActive ||
    !args.universityId ||
    supervisor.universityId !== args.universityId
  ) {
    throw new ApiError('Replacement supervisor must be active and belong to the same university.', 422, 'INVALID_INPUT')
  }
  return supervisor
}

export async function executeSupervisorTransition(args: {
  actor: TransitionActor
  supervisorId: string
  operation: SupervisorTransitionOperation
  targetUniversityId?: string | null
  reason: string
  fingerprint: string
  teamResolutions: TeamTransitionResolution[]
  joinRequestResolutions: JoinRequestTransitionResolution[]
  ticketResolutions: TicketTransitionResolution[]
}) {
  requireFullAdmin(args.actor)
  const reason = args.reason.trim().replace(/\s+/g, ' ')
  if (reason.length < 5 || reason.length > 500) {
    throw new ApiError('Reason must be between 5 and 500 characters.', 400, 'INVALID_INPUT')
  }

  return prisma.$transaction(
    async (tx) => {
      const preflight = await buildPreflight({
        supervisorId: args.supervisorId,
        operation: args.operation,
        targetUniversityId: args.targetUniversityId,
        db: tx,
      })
      if (preflight.fingerprint !== args.fingerprint) {
        throw new ApiError(
          'Assignments changed after this review was prepared. Refresh and review the transition again.',
          409,
          'CONFLICT'
        )
      }

      assertExactResolutionIds(
        preflight.currentTeams.map((team) => team.id),
        args.teamResolutions.map((resolution) => resolution.teamId),
        'current team'
      )
      assertExactResolutionIds(
        preflight.unrelatedRequests.map((request) => request.id),
        args.joinRequestResolutions.map((resolution) => resolution.joinRequestId),
        'unrelated pending join request'
      )
      assertExactResolutionIds(
        preflight.unrelatedTickets.map((ticket) => ticket.id),
        args.ticketResolutions.map((resolution) => resolution.ticketId),
        'unrelated unresolved support ticket'
      )

      for (const resolution of args.teamResolutions) {
        if (resolution.action === 'REASSIGN' && !resolution.supervisorId) {
          throw new ApiError('Select a replacement supervisor for every reassigned team.', 422, 'INVALID_INPUT')
        }
        await changeTeamSupervisorInTransaction({
          tx,
          actor: args.actor,
          teamId: resolution.teamId,
          supervisorId: resolution.action === 'REASSIGN' ? resolution.supervisorId! : null,
          reason,
        })
      }

      for (const resolution of args.joinRequestResolutions) {
        const request = preflight.unrelatedRequests.find((entry) => entry.id === resolution.joinRequestId)!
        if (resolution.action === 'REASSIGN') {
          const supervisor = await requireResolutionSupervisor({
            supervisorId: resolution.supervisorId,
            universityId: request.student.universityId,
            excludedSupervisorId: args.supervisorId,
            db: tx,
          })
          await tx.joinRequest.update({
            where: { id: request.id },
            data: { supervisorId: supervisor.id, supervisorEmailEntered: supervisor.email },
          })
          await tx.notification.create({
            data: {
              userId: request.student.id,
              type: 'JOIN_REQUEST_REASSIGNED',
              title: 'Your join request has a new advisor',
              message: `An administrator reassigned your pending request to ${supervisor.email}.`,
              link: '/join-team',
            },
          })
        } else {
          await tx.joinRequest.update({
            where: { id: request.id },
            data: { status: 'CANCELED', resolvedAt: new Date() },
          })
          await tx.notification.create({
            data: {
              userId: request.student.id,
              type: 'JOIN_REQUEST_CANCELED',
              title: 'Your pending join request was canceled',
              message: `An administrator canceled the request because of an advisor change. You can submit a new request.`,
              link: '/join-team',
            },
          })
        }
      }

      for (const resolution of args.ticketResolutions) {
        const ticket = preflight.unrelatedTickets.find((entry) => entry.id === resolution.ticketId)!
        if (resolution.action === 'REASSIGN') {
          const supervisor = await requireResolutionSupervisor({
            supervisorId: resolution.supervisorId,
            universityId: ticket.createdBy.universityId,
            excludedSupervisorId: args.supervisorId,
            db: tx,
          })
          await tx.supportTicket.update({
            where: { id: ticket.id },
            data: {
              supervisorId: supervisor.id,
              assignedToId: ticket.assignedToId === args.supervisorId ? supervisor.id : ticket.assignedToId,
            },
          })
        } else {
          await tx.supportTicket.update({
            where: { id: ticket.id },
            data: {
              supervisorId: null,
              assignedToId: ticket.assignedToId === args.supervisorId ? null : ticket.assignedToId,
              status: 'ESCALATED',
              escalatedAt: new Date(),
              escalatedById: args.actor.id,
              escalationReason: reason,
            },
          })
        }
        await tx.notification.create({
          data: {
            userId: ticket.createdBy.id,
            type: 'SUPPORT_TICKET_ROUTING_CHANGED',
            title: `Support routing updated for ${ticket.subject}`,
            message: resolution.action === 'REASSIGN'
              ? 'Your open support request was reassigned to another advisor.'
              : 'Your open support request was escalated to the administrator team.',
            link: '/support',
          },
        })
      }

      const before = {
        universityId: preflight.supervisor.universityId,
        isActive: preflight.supervisor.isActive,
      }
      const userData: Prisma.UserUpdateInput = args.operation === 'CHANGE_UNIVERSITY'
        ? { university: { connect: { id: preflight.targetUniversity!.id } } }
        : { isActive: false }
      const updatedSupervisor = await tx.user.update({
        where: { id: preflight.supervisor.id },
        data: userData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          universityId: true,
          isActive: true,
          university: { select: { id: true, name: true } },
        },
      })
      if (args.operation === 'DEACTIVATE') {
        await tx.session.deleteMany({ where: { userId: updatedSupervisor.id } })
      } else {
        await tx.notification.create({
          data: {
            userId: updatedSupervisor.id,
            type: 'SUPERVISOR_UNIVERSITY_CHANGED',
            title: 'Your university affiliation changed',
            message: `Your RevME account is now affiliated with ${updatedSupervisor.university?.name}.`,
            link: '/settings',
          },
        })
      }

      await tx.auditLog.create({
        data: buildAuditLogData(args.actor, 'SUPERVISOR_TRANSITION_COMPLETED', 'User', updatedSupervisor.id, {
          details: {
            operation: args.operation,
            reason,
            teamResolutions: args.teamResolutions,
            joinRequestResolutions: args.joinRequestResolutions,
            ticketResolutions: args.ticketResolutions,
          },
          before,
          after: {
            universityId: updatedSupervisor.universityId,
            isActive: updatedSupervisor.isActive,
          },
        }),
      })

      return { supervisor: updatedSupervisor }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
