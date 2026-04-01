import { Prisma, TeamStatus, User } from '@prisma/client'
import { prisma } from '@/server/db'
import { buildAuditLogData } from '@/lib/audit'
import { ApiError } from '@/server/http'
import { sameUniversity } from '@/server/universities'
import {
  ensureUniqueTeamName,
  normalizeTeamName,
  resolveAssignableSupervisor,
  TEAM_SUPERVISOR_CAP,
} from '@/server/team-management'

type DbClient = Prisma.TransactionClient | typeof prisma
type AccessMode = 'admin' | 'supervisor'

type RosterActor = Pick<User, 'id' | 'email' | 'role' | 'universityId' | 'hasFullAccess'>

export interface EligibleStudentResult {
  id: string
  email: string
  firstName: string
  lastName: string
}

export interface EligibleSupervisorResult {
  id: string
  email: string
  firstName: string
  lastName: string
}

const currentManagedStatuses = new Set<TeamStatus>(['PENDING_APPROVAL', 'APPROVED', 'ACTIVE'])
const blockedRosterStatuses = new Set<TeamStatus>(['REJECTED', 'DISQUALIFIED', 'ARCHIVED'])

const teamRosterInclude = Prisma.validator<Prisma.TeamInclude>()({
  university: true,
  season: true,
  supervisor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      universityId: true,
      university: {
        select: {
          id: true,
          name: true,
          normalizedName: true,
        },
      },
    },
  },
  members: {
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          universityId: true,
          university: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
            },
          },
        },
      },
    },
    orderBy: [{ isSubmitter: 'desc' }, { joinedAt: 'asc' }],
  },
  _count: {
    select: {
      submissions: true,
      warnings: true,
      supportTickets: true,
    },
  },
})

type RosterTeam = Prisma.TeamGetPayload<{
  include: typeof teamRosterInclude
}>

function requireManageAccess(team: { supervisorId: string | null }, actor: RosterActor, access: AccessMode) {
  if (access === 'admin') return
  if (team.supervisorId !== actor.id) {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }
}

function getSubmitter(team: Pick<RosterTeam, 'members'>) {
  return team.members.find((member) => member.isSubmitter) ?? null
}

function getRosterSnapshot(team: Pick<RosterTeam, 'id' | 'name' | 'status' | 'supervisorId' | 'members'>) {
  return {
    teamId: team.id,
    teamName: team.name,
    status: team.status,
    supervisorId: team.supervisorId,
    memberCount: team.members.length,
    submitterMemberId: getSubmitter(team)?.id ?? null,
    members: team.members.map((member) => ({
      memberId: member.id,
      userId: member.userId,
      email: member.user.email,
      isSubmitter: member.isSubmitter,
    })),
  }
}

async function getRosterTeam(teamId: string, db: DbClient) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: teamRosterInclude,
  })

  if (!team) {
    throw new ApiError('Team not found', 404, 'NOT_FOUND')
  }

  return team
}

async function resolveStudent(
  args: {
    studentId?: string
    email?: string
  },
  db: DbClient
) {
  const trimmedEmail = args.email?.trim().toLowerCase()
  if (!args.studentId && !trimmedEmail) {
    throw new ApiError('Student identifier is required', 400, 'INVALID_INPUT')
  }

  const student = args.studentId
    ? await db.user.findUnique({
        where: { id: args.studentId },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
            },
          },
        },
      })
    : await db.user.findUnique({
        where: { email: trimmedEmail! },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
            },
          },
        },
      })

  if (!student) {
    throw new ApiError('Student not found. They must register first.', 404, 'NOT_FOUND')
  }

  if (student.role !== 'STUDENT') {
    throw new ApiError('User is not a student', 422, 'INVALID_INPUT')
  }

  return student
}

async function ensureEligibleStudent(team: RosterTeam, student: Awaited<ReturnType<typeof resolveStudent>>, db: DbClient) {
  if (!student.universityId || !sameUniversity(team.university, student.university)) {
    throw new ApiError('Student must belong to the same university as the team', 422, 'INVALID_INPUT')
  }

  const existingMembership = await db.teamMember.findFirst({
    where: { userId: student.id },
    include: { team: true },
  })

  if (existingMembership) {
    throw new ApiError(
      `Student is already assigned to ${existingMembership.team.name}. Remove them there first.`,
      409,
      'CONFLICT'
    )
  }
}

function ensureCanManageRoster(team: RosterTeam) {
  if (blockedRosterStatuses.has(team.status)) {
    throw new ApiError('Roster changes are not allowed for rejected, disqualified, or archived teams', 422, 'INVALID_INPUT')
  }
}

function ensureSameCompetitionScope(sourceTeam: RosterTeam, targetTeam: RosterTeam) {
  if (sourceTeam.id === targetTeam.id) {
    throw new ApiError('Source and target teams must be different', 422, 'INVALID_INPUT')
  }

  if (!sameUniversity(sourceTeam.university, targetTeam.university)) {
    throw new ApiError('Members can only be moved between teams in the same university', 422, 'INVALID_INPUT')
  }

  if (sourceTeam.seasonId !== targetTeam.seasonId) {
    throw new ApiError('Members can only be moved between teams in the same season', 422, 'INVALID_INPUT')
  }
}

export async function renameTeam(args: {
  actor: RosterActor
  access: AccessMode
  teamId: string
  name: string
}) {
  return prisma.$transaction(async (tx) => {
    const team = await getRosterTeam(args.teamId, tx)
    requireManageAccess(team, args.actor, args.access)

    const nextName = normalizeTeamName(args.name)
    if (!nextName) {
      throw new ApiError('Team name is required', 400, 'INVALID_INPUT')
    }

    if (nextName === team.name) {
      return team
    }

    await ensureUniqueTeamName({ teamId: team.id, name: nextName, db: tx })

    const updated = await tx.team.update({
      where: { id: team.id },
      data: { name: nextName },
      include: teamRosterInclude,
    })

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_RENAMED', 'Team', team.id, {
        details: {
          previousName: team.name,
          nextName,
        },
        before: { name: team.name },
        after: { name: updated.name },
      }),
    })

    return updated
  })
}

export async function addMemberToTeam(args: {
  actor: RosterActor
  access: AccessMode
  teamId: string
  studentId?: string
  email?: string
}) {
  return prisma.$transaction(async (tx) => {
    const team = await getRosterTeam(args.teamId, tx)
    requireManageAccess(team, args.actor, args.access)
    ensureCanManageRoster(team)

    if (team.members.length >= 5) {
      throw new ApiError('Maximum 5 students per team', 422, 'CONFLICT')
    }

    const student = await resolveStudent({ studentId: args.studentId, email: args.email }, tx)
    await ensureEligibleStudent(team, student, tx)

    const hasSubmitter = team.members.some((member) => member.isSubmitter)
    const member = await tx.teamMember.create({
      data: {
        userId: student.id,
        teamId: team.id,
        isSubmitter: team.members.length === 0 || !hasSubmitter,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    const updatedTeam = await getRosterTeam(team.id, tx)

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_MEMBER_ADDED', 'Team', team.id, {
        details: {
          memberUserId: student.id,
          memberEmail: student.email,
          access: args.access,
        },
        before: getRosterSnapshot(team),
        after: getRosterSnapshot(updatedTeam),
      }),
    })

    return member
  })
}

export async function removeMemberFromTeam(args: {
  actor: RosterActor
  access: AccessMode
  teamId: string
  memberId: string
  replacementMemberId?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    const team = await getRosterTeam(args.teamId, tx)
    requireManageAccess(team, args.actor, args.access)
    ensureCanManageRoster(team)

    const member = team.members.find((entry) => entry.id === args.memberId)
    if (!member) {
      throw new ApiError('Member not found', 404, 'NOT_FOUND')
    }

    const remainingMembers = team.members.filter((entry) => entry.id !== member.id)
    if (remainingMembers.length === 0 && currentManagedStatuses.has(team.status)) {
      throw new ApiError(
        'You cannot remove the last member from a pending, approved, or active team.',
        422,
        'INVALID_INPUT'
      )
    }

    if (member.isSubmitter && remainingMembers.length > 0) {
      if (!args.replacementMemberId) {
        throw new ApiError(
          'Choose a replacement submitter before removing the current submitter.',
          422,
          'INVALID_INPUT'
        )
      }

      if (!remainingMembers.some((entry) => entry.id === args.replacementMemberId)) {
        throw new ApiError('Replacement submitter must be another current team member.', 422, 'INVALID_INPUT')
      }
    }

    await tx.teamMember.delete({
      where: { id: member.id },
    })

    if (member.isSubmitter && remainingMembers.length > 0) {
      await tx.teamMember.updateMany({
        where: { teamId: team.id },
        data: { isSubmitter: false },
      })
      await tx.teamMember.update({
        where: { id: args.replacementMemberId! },
        data: { isSubmitter: true },
      })
    }

    const updatedTeam = await getRosterTeam(team.id, tx)

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_MEMBER_REMOVED', 'Team', team.id, {
        details: {
          removedMemberId: member.id,
          removedUserId: member.userId,
          removedEmail: member.user.email,
          replacementMemberId: args.replacementMemberId ?? null,
          access: args.access,
        },
        before: getRosterSnapshot(team),
        after: getRosterSnapshot(updatedTeam),
      }),
    })

    return updatedTeam
  })
}

export async function setTeamSubmitter(args: {
  actor: RosterActor
  access: AccessMode
  teamId: string
  memberId: string
}) {
  return prisma.$transaction(async (tx) => {
    const team = await getRosterTeam(args.teamId, tx)
    requireManageAccess(team, args.actor, args.access)
    ensureCanManageRoster(team)

    const member = team.members.find((entry) => entry.id === args.memberId)
    if (!member) {
      throw new ApiError('Member not found', 404, 'NOT_FOUND')
    }

    await tx.teamMember.updateMany({
      where: { teamId: team.id },
      data: { isSubmitter: false },
    })

    await tx.teamMember.update({
      where: { id: member.id },
      data: { isSubmitter: true },
    })

    const updatedTeam = await getRosterTeam(team.id, tx)

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_SUBMITTER_CHANGED', 'Team', team.id, {
        details: {
          nextSubmitterMemberId: member.id,
          nextSubmitterUserId: member.userId,
          nextSubmitterEmail: member.user.email,
          access: args.access,
        },
        before: getRosterSnapshot(team),
        after: getRosterSnapshot(updatedTeam),
      }),
    })

    return updatedTeam
  })
}

export async function reassignTeamSupervisor(args: {
  actor: RosterActor
  teamId: string
  supervisorId: string
}) {
  return prisma.$transaction(async (tx) => {
    const team = await getRosterTeam(args.teamId, tx)

    if (team.supervisorId === args.supervisorId) {
      return team
    }

    const supervisor = await resolveAssignableSupervisor({
      supervisorId: args.supervisorId,
      university: team.university,
      teamIdToExclude: team.id,
      db: tx,
    })

    const updatedTeam = await tx.team.update({
      where: { id: team.id },
      data: { supervisorId: supervisor.id },
      include: teamRosterInclude,
    })

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_SUPERVISOR_CHANGED', 'Team', team.id, {
        details: {
          previousSupervisorId: team.supervisorId,
          previousSupervisorEmail: team.supervisor?.email ?? null,
          nextSupervisorId: supervisor.id,
          nextSupervisorEmail: supervisor.email,
        },
        before: {
          supervisorId: team.supervisorId,
          supervisorEmail: team.supervisor?.email ?? null,
        },
        after: {
          supervisorId: updatedTeam.supervisorId,
          supervisorEmail: updatedTeam.supervisor?.email ?? null,
        },
      }),
    })

    return updatedTeam
  })
}

export async function moveTeamMembers(args: {
  actor: RosterActor
  sourceTeamId: string
  targetTeamId: string
  memberIds: string[]
  sourceReplacementMemberId?: string | null
  targetSubmitterMemberId?: string | null
}) {
  return prisma.$transaction(async (tx) => {
    if (args.memberIds.length === 0) {
      throw new ApiError('Select at least one member to move', 400, 'INVALID_INPUT')
    }

    const uniqueMemberIds = Array.from(new Set(args.memberIds))
    const sourceTeam = await getRosterTeam(args.sourceTeamId, tx)
    const targetTeam = await getRosterTeam(args.targetTeamId, tx)

    ensureSameCompetitionScope(sourceTeam, targetTeam)
    ensureCanManageRoster(sourceTeam)
    ensureCanManageRoster(targetTeam)

    const movedMembers = sourceTeam.members.filter((member) => uniqueMemberIds.includes(member.id))
    if (movedMembers.length !== uniqueMemberIds.length) {
      throw new ApiError('All selected members must belong to the source team', 422, 'INVALID_INPUT')
    }

    const sourceRemainingMembers = sourceTeam.members.filter((member) => !uniqueMemberIds.includes(member.id))
    if (sourceRemainingMembers.length === 0 && currentManagedStatuses.has(sourceTeam.status)) {
      throw new ApiError(
        'You cannot move all members out of a pending, approved, or active team.',
        422,
        'INVALID_INPUT'
      )
    }

    const movingSubmitter = movedMembers.some((member) => member.isSubmitter)
    if (movingSubmitter && sourceRemainingMembers.length > 0) {
      if (!args.sourceReplacementMemberId) {
        throw new ApiError(
          'Choose a replacement submitter for the source team before moving the current submitter.',
          422,
          'INVALID_INPUT'
        )
      }

      if (!sourceRemainingMembers.some((member) => member.id === args.sourceReplacementMemberId)) {
        throw new ApiError('Source replacement submitter must stay on the source team.', 422, 'INVALID_INPUT')
      }
    }

    if (targetTeam.members.length + movedMembers.length > 5) {
      throw new ApiError('Target team cannot exceed 5 members', 422, 'CONFLICT')
    }

    const targetHasSubmitter = targetTeam.members.some((member) => member.isSubmitter)
    const targetWillHaveMembers = targetTeam.members.length + movedMembers.length > 0
    if (!targetHasSubmitter && targetWillHaveMembers) {
      if (!args.targetSubmitterMemberId) {
        throw new ApiError(
          'Choose the submitter for the target team before completing the move.',
          422,
          'INVALID_INPUT'
        )
      }

      const validTargetSubmitterIds = new Set([
        ...targetTeam.members.map((member) => member.id),
        ...movedMembers.map((member) => member.id),
      ])
      if (!validTargetSubmitterIds.has(args.targetSubmitterMemberId)) {
        throw new ApiError('Target submitter must be a current or moved member of the target team.', 422, 'INVALID_INPUT')
      }
    }

    if (movingSubmitter && sourceRemainingMembers.length > 0) {
      await tx.teamMember.updateMany({
        where: { teamId: sourceTeam.id },
        data: { isSubmitter: false },
      })
      await tx.teamMember.update({
        where: { id: args.sourceReplacementMemberId! },
        data: { isSubmitter: true },
      })
    }

    await tx.teamMember.updateMany({
      where: { id: { in: uniqueMemberIds } },
      data: {
        teamId: targetTeam.id,
        isSubmitter: false,
      },
    })

    if (!targetHasSubmitter && targetWillHaveMembers) {
      await tx.teamMember.updateMany({
        where: { teamId: targetTeam.id },
        data: { isSubmitter: false },
      })
      await tx.teamMember.update({
        where: { id: args.targetSubmitterMemberId! },
        data: { isSubmitter: true },
      })
    }

    const updatedSourceTeam = await getRosterTeam(sourceTeam.id, tx)
    const updatedTargetTeam = await getRosterTeam(targetTeam.id, tx)
    const action = movedMembers.length > 1 ? 'TEAM_MEMBERS_BULK_MOVED' : 'TEAM_MEMBER_MOVED'
    const details = {
      sourceTeamId: sourceTeam.id,
      targetTeamId: targetTeam.id,
      movedMemberIds: movedMembers.map((member) => member.id),
      movedUserIds: movedMembers.map((member) => member.userId),
      movedEmails: movedMembers.map((member) => member.user.email),
      sourceReplacementMemberId: args.sourceReplacementMemberId ?? null,
      targetSubmitterMemberId: args.targetSubmitterMemberId ?? null,
    }

    await tx.auditLog.createMany({
      data: [
        buildAuditLogData(args.actor, action, 'Team', sourceTeam.id, {
          details,
          before: getRosterSnapshot(sourceTeam),
          after: getRosterSnapshot(updatedSourceTeam),
        }),
        buildAuditLogData(args.actor, action, 'Team', targetTeam.id, {
          details,
          before: getRosterSnapshot(targetTeam),
          after: getRosterSnapshot(updatedTargetTeam),
        }),
      ],
    })

    return {
      sourceTeam: updatedSourceTeam,
      targetTeam: updatedTargetTeam,
    }
  })
}

export async function getAdminTeamDetail(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: teamRosterInclude,
  })

  if (!team) {
    throw new ApiError('Team not found', 404, 'NOT_FOUND')
  }

  const recentActivity = await prisma.auditLog.findMany({
    where: {
      entityType: 'Team',
      entityId: teamId,
    },
    orderBy: { createdAt: 'desc' },
    take: 12,
  })

  return { team, recentActivity }
}

export async function searchEligibleStudents(args: {
  actor: RosterActor
  access: AccessMode
  teamId: string
  query?: string
}) {
  const team = await getRosterTeam(args.teamId, prisma)
  requireManageAccess(team, args.actor, args.access)
  ensureCanManageRoster(team)

  const query = args.query?.trim()

  const students = await prisma.user.findMany({
    where: {
      role: 'STUDENT',
      teamMemberships: {
        none: {},
      },
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      university: {
        select: {
          id: true,
          name: true,
          normalizedName: true,
        },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
  })

  return students
    .filter((student) => sameUniversity(team.university, student.university))
    .slice(0, 12)
    .map(({ university: _university, ...student }) => student)
}

export async function searchEligibleSupervisors(args: {
  actor: RosterActor
  teamId: string
  query?: string
}) {
  const team = await getRosterTeam(args.teamId, prisma)
  const query = args.query?.trim()

  const supervisors = await prisma.user.findMany({
    where: {
      role: 'SUPERVISOR',
      isActive: true,
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      university: {
        select: {
          id: true,
          name: true,
          normalizedName: true,
        },
      },
      _count: {
        select: {
          supervisedTeams: true,
        },
      },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
  })

  return supervisors
    .filter(
      (supervisor) =>
        sameUniversity(team.university, supervisor.university) &&
        (supervisor.id === team.supervisorId || supervisor._count.supervisedTeams < TEAM_SUPERVISOR_CAP)
    )
    .slice(0, 12)
    .map(({ university: _university, _count: _count, ...supervisor }) => supervisor)
}
