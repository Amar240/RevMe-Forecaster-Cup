import crypto from 'crypto'
import { Prisma, User } from '@prisma/client'
import { prisma } from '@/server/db'
import { hashPassword } from '@/lib/auth'
import { sendPasswordResetEmail } from '@/lib/email'
import { logAuditAction } from '@/lib/audit'
import { ApiError } from '@/server/http'
import { getCurrentSupervisorResponsibilityWhere } from '@/server/team-supervisor-assignment'

type DbClient = Prisma.TransactionClient | typeof prisma

type UserManagementActor = Pick<User, 'id' | 'email' | 'role' | 'universityId'>
type ManagedScope = 'admin-student' | 'admin-supervisor' | 'supervisor-student'
type ManagedRole = 'STUDENT' | 'SUPERVISOR'

const universitySelect = {
  id: true,
  name: true,
  normalizedName: true,
} satisfies Prisma.UniversitySelect

export const managedUserListSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  universityId: true,
  university: {
    select: {
      id: true,
      name: true,
    },
  },
  teamMemberships: {
    select: {
      id: true,
      isSubmitter: true,
      team: {
        select: {
          id: true,
          name: true,
          displayId: true,
        },
      },
    },
    orderBy: [{ isSubmitter: 'desc' }, { joinedAt: 'asc' }],
  },
  _count: {
    select: {
      supervisedTeams: true,
      submissions: true,
      teamMemberships: true,
      joinRequestsAsStudent: true,
      joinRequestsAsSupervisor: true,
      supportTicketsCreated: true,
      supportTicketsAsSupervisor: true,
      supportTicketsAssigned: true,
      supportTicketsEscalated: true,
      ticketReplies: true,
    },
  },
})

const managedUserMutationSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  universityId: true,
  university: {
    select: universitySelect,
  },
  _count: {
    select: {
      supervisedTeams: true,
      submissions: true,
      teamMemberships: true,
    },
  },
})

type ManagedMutationUser = Prisma.UserGetPayload<{
  select: typeof managedUserMutationSelect
}>

const managedUserDeleteEligibilitySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  teamMemberships: {
    select: {
      team: { select: { id: true, name: true, displayId: true } },
    },
  },
  _count: {
    select: {
      supervisedTeams: true,
      submissions: true,
      teamMemberships: true,
      joinRequestsAsStudent: true,
      joinRequestsAsSupervisor: true,
      supportTicketsCreated: true,
      supportTicketsAsSupervisor: true,
      supportTicketsAssigned: true,
      supportTicketsEscalated: true,
      ticketReplies: true,
    },
  },
})

type ManagedDeleteEligibilityUser = Prisma.UserGetPayload<{
  select: typeof managedUserDeleteEligibilitySelect
}>

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function getScopeRole(scope: ManagedScope): ManagedRole {
  return scope === 'admin-supervisor' ? 'SUPERVISOR' : 'STUDENT'
}

function assertScopeActor(scope: ManagedScope, actor: UserManagementActor) {
  if (scope === 'supervisor-student' && actor.role !== 'SUPERVISOR') {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }

  if (scope !== 'supervisor-student' && actor.role !== 'ADMIN' && actor.role !== 'SUB_ADMIN') {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }
}

function assertSupervisorActorHasUniversity(actor: UserManagementActor) {
  if (!actor.universityId) {
    throw new ApiError(
      'Your supervisor account must be linked to a university before you can manage students.',
      422,
      'INVALID_INPUT'
    )
  }
}

async function requireUniversity(universityId: string, db: DbClient) {
  const university = await db.university.findUnique({
    where: { id: universityId },
    select: universitySelect,
  })

  if (!university) {
    throw new ApiError('University not found', 404, 'NOT_FOUND')
  }

  return university
}

async function getManagedUserOrThrow(userId: string, db: DbClient) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: managedUserMutationSelect,
  })

  if (!user) {
    throw new ApiError('User not found', 404, 'NOT_FOUND')
  }

  return user
}

function assertTargetRoleMatchesScope(scope: ManagedScope, user: Pick<ManagedMutationUser, 'role'>) {
  const expectedRole = getScopeRole(scope)
  if (user.role !== expectedRole) {
    throw new ApiError(
      expectedRole === 'SUPERVISOR' ? 'Supervisor not found' : 'Student not found',
      404,
      'NOT_FOUND'
    )
  }
}

function assertSupervisorScopeMatch(
  actor: UserManagementActor,
  user: Pick<ManagedMutationUser, 'universityId'>,
  operation: 'read' | 'write'
) {
  if (!actor.universityId) {
    throw new ApiError(
      `Your supervisor account must be linked to a university before you can ${operation} students.`,
      422,
      'INVALID_INPUT'
    )
  }

  if (!user.universityId || user.universityId !== actor.universityId) {
    throw new ApiError('You can only manage students from your own university', 403, 'FORBIDDEN')
  }
}

function buildResetCredentials() {
  const tempPassword = crypto.randomBytes(9).toString('base64').slice(0, 12)
  const resetToken = crypto.randomBytes(32).toString('hex')
  const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

  return { tempPassword, resetToken, resetTokenExpiry }
}

export function getManagedUserDeleteEligibility(args: {
  actorId: string
  user: ManagedDeleteEligibilityUser
}) {
  const { actorId, user } = args

  if (user.id === actorId) {
    return {
      canDelete: false,
      deleteBlockedReason: 'You cannot delete your own account.',
    }
  }

  if (user.role !== 'STUDENT') {
    return {
      canDelete: false,
      deleteBlockedReason: 'Only clean student accounts can be deleted from this page.',
    }
  }

  if (user._count.teamMemberships > 0) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Users with team memberships cannot be deleted.',
    }
  }

  if (user._count.supervisedTeams > 0) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Users with supervised teams cannot be deleted.',
    }
  }

  if (user._count.submissions > 0) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Users with submissions cannot be deleted.',
    }
  }

  if (user._count.joinRequestsAsStudent > 0 || user._count.joinRequestsAsSupervisor > 0) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Users with join request history cannot be deleted.',
    }
  }

  if (
    user._count.supportTicketsCreated > 0 ||
    user._count.supportTicketsAsSupervisor > 0 ||
    user._count.supportTicketsAssigned > 0 ||
    user._count.supportTicketsEscalated > 0 ||
    user._count.ticketReplies > 0
  ) {
    return {
      canDelete: false,
      deleteBlockedReason: 'Users with support ticket activity cannot be deleted.',
    }
  }

  return {
    canDelete: true,
    deleteBlockedReason: null,
  }
}

export async function createManagedUser(args: {
  actor: UserManagementActor
  scope: ManagedScope
  firstName: string
  lastName: string
  email: string
  universityId?: string
}) {
  assertScopeActor(args.scope, args.actor)

  if (args.scope === 'supervisor-student') {
    assertSupervisorActorHasUniversity(args.actor)
  }

  const firstName = normalizeName(args.firstName)
  const lastName = normalizeName(args.lastName)
  const email = normalizeEmail(args.email)

  if (!firstName) throw new ApiError('First name is required', 400, 'INVALID_INPUT')
  if (!lastName) throw new ApiError('Last name is required', 400, 'INVALID_INPUT')
  if (!email) throw new ApiError('Email is required', 400, 'INVALID_INPUT')

  const role = getScopeRole(args.scope)
  const effectiveUniversityId =
    args.scope === 'supervisor-student' ? args.actor.universityId ?? undefined : args.universityId

  if (!effectiveUniversityId) {
    throw new ApiError('University is required', 400, 'INVALID_INPUT')
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })

  if (existingUser) {
    throw new ApiError('Email already in use', 409, 'CONFLICT')
  }

  const university = await requireUniversity(effectiveUniversityId, prisma)

  const configuredDevPassword = process.env.DEV_DEFAULT_PASSWORD
  const useDevDefaultPassword =
    Boolean(configuredDevPassword) &&
    (args.scope === 'admin-student' || args.scope === 'admin-supervisor')
  const resetCredentials = useDevDefaultPassword ? null : buildResetCredentials()
  const passwordHash = await hashPassword(
    useDevDefaultPassword ? configuredDevPassword! : resetCredentials!.tempPassword
  )

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      role,
      universityId: university.id,
      passwordHash,
      resetToken: useDevDefaultPassword ? null : resetCredentials!.resetToken,
      resetTokenExpiry: useDevDefaultPassword ? null : resetCredentials!.resetTokenExpiry,
      emailVerified: true,
      isActive: true,
      rulesAcknowledgedAt: useDevDefaultPassword && role === 'STUDENT' ? new Date() : null,
    },
    select: managedUserMutationSelect,
  })

  const emailSent = useDevDefaultPassword
    ? false
    : await sendPasswordResetEmail(email, resetCredentials!.resetToken)

  await logAuditAction(args.actor.id, `${role}_CREATED`, 'User', user.id, {
    email: user.email,
    role: user.role,
    universityId: user.universityId,
    emailSent,
    devPasswordMode: useDevDefaultPassword,
  })

  return {
    user,
    emailSent,
    devPassword: useDevDefaultPassword ? configuredDevPassword : undefined,
  }
}

export async function updateManagedUser(args: {
  actor: UserManagementActor
  scope: ManagedScope
  userId: string
  firstName: string
  lastName: string
  email: string
  universityId?: string
}) {
  assertScopeActor(args.scope, args.actor)

  const currentUser = await getManagedUserOrThrow(args.userId, prisma)
  assertTargetRoleMatchesScope(args.scope, currentUser)

  if (args.scope === 'supervisor-student') {
    assertSupervisorScopeMatch(args.actor, currentUser, 'write')
  }

  const firstName = normalizeName(args.firstName)
  const lastName = normalizeName(args.lastName)
  const email = normalizeEmail(args.email)

  if (!firstName) throw new ApiError('First name is required', 400, 'INVALID_INPUT')
  if (!lastName) throw new ApiError('Last name is required', 400, 'INVALID_INPUT')
  if (!email) throw new ApiError('Email is required', 400, 'INVALID_INPUT')

  const effectiveUniversityId =
    args.scope === 'supervisor-student' ? args.actor.universityId ?? undefined : args.universityId

  if (!effectiveUniversityId) {
    throw new ApiError('University is required', 400, 'INVALID_INPUT')
  }

  if (email !== currentUser.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser && existingUser.id !== currentUser.id) {
      throw new ApiError('Email already in use', 409, 'CONFLICT')
    }
  }

  await requireUniversity(effectiveUniversityId, prisma)

  const universityChanged = effectiveUniversityId !== currentUser.universityId

  if (
    currentUser.role === 'STUDENT' &&
    universityChanged &&
    (currentUser._count.teamMemberships > 0 || currentUser._count.submissions > 0)
  ) {
    throw new ApiError(
      'Student university cannot be changed after they have team memberships or submissions.',
      422,
      'INVALID_INPUT'
    )
  }

  if (currentUser.role === 'SUPERVISOR' && universityChanged) {
    if (args.actor.role !== 'ADMIN') {
      throw new ApiError('Only full administrators can change a supervisor university.', 403, 'FORBIDDEN')
    }
    const affectedTeamCount = await prisma.team.count({
      where: { supervisorId: currentUser.id },
    })
    if (affectedTeamCount > 0) {
      throw new ApiError(
        'Use Correct university affiliation to review and move the supervisor, their teams, and affected students together.',
        409,
        'CONFLICT',
        { transitionRequired: true, operation: 'CORRECT_AFFILIATION', affectedTeamCount }
      )
    }
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const nextUser = await tx.user.update({
      where: { id: currentUser.id },
      data: {
        email,
        firstName,
        lastName,
        universityId: effectiveUniversityId,
      },
      select: managedUserMutationSelect,
    })

    if (currentUser.role === 'SUPERVISOR' && email !== currentUser.email) {
      await tx.joinRequest.updateMany({
        where: {
          status: 'PENDING',
          OR: [
            { supervisorId: currentUser.id },
            { supervisorEmailEntered: currentUser.email },
          ],
        },
        data: { supervisorEmailEntered: email },
      })
    }

    return nextUser
  })

  await logAuditAction(args.actor.id, `${currentUser.role}_UPDATED`, 'User', currentUser.id, {
    before: {
      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      universityId: currentUser.universityId,
    },
    after: {
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      universityId: updatedUser.universityId,
    },
  })

  return updatedUser
}

export async function setManagedUserActiveStatus(args: {
  actor: UserManagementActor
  scope: ManagedScope
  userId: string
  isActive: boolean
}) {
  assertScopeActor(args.scope, args.actor)

  const currentUser = await getManagedUserOrThrow(args.userId, prisma)
  assertTargetRoleMatchesScope(args.scope, currentUser)

  if (args.scope === 'supervisor-student') {
    assertSupervisorScopeMatch(args.actor, currentUser, 'write')
  }

  if (currentUser.role === 'SUPERVISOR' && !args.isActive && args.actor.role !== 'ADMIN') {
    throw new ApiError('Only full administrators can deactivate supervisors.', 403, 'FORBIDDEN')
  }

  if (currentUser.role === 'SUPERVISOR' && !args.isActive) {
    const currentTeamCount = await prisma.team.count({
      where: getCurrentSupervisorResponsibilityWhere(currentUser.id),
    })
    if (currentTeamCount > 0) {
      throw new ApiError(
        'Resolve the supervisor’s current team assignments before deactivation.',
        409,
        'CONFLICT',
        { transitionRequired: true, operation: 'DEACTIVATE', currentTeamCount }
      )
    }
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const nextUser = await tx.user.update({
      where: { id: currentUser.id },
      data: { isActive: args.isActive },
      select: managedUserMutationSelect,
    })

    if (!args.isActive) {
      await tx.session.deleteMany({ where: { userId: currentUser.id } })
    }

    return nextUser
  })

  await logAuditAction(args.actor.id, `${currentUser.role}_STATUS_CHANGED`, 'User', currentUser.id, {
    before: { isActive: currentUser.isActive },
    after: { isActive: updatedUser.isActive },
  })

  return updatedUser
}

export async function deleteManagedStudent(args: {
  actor: UserManagementActor
  userId: string
}) {
  if (args.actor.role !== 'ADMIN' && args.actor.role !== 'SUB_ADMIN') {
    throw new ApiError('Forbidden', 403, 'FORBIDDEN')
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: args.userId },
    select: managedUserDeleteEligibilitySelect,
  })

  if (!targetUser) {
    throw new ApiError('User not found', 404, 'NOT_FOUND')
  }

  const eligibility = getManagedUserDeleteEligibility({
    actorId: args.actor.id,
    user: targetUser,
  })

  if (!eligibility.canDelete) {
    throw new ApiError(
      eligibility.deleteBlockedReason ?? 'This user cannot be deleted. Deactivate the account instead.',
      422,
      'INVALID_INPUT',
      {
        deletionEligibility: {
          ...eligibility,
          memberships: targetUser.teamMemberships.map((membership) => ({
            teamId: membership.team.id,
            teamName: membership.team.name,
            displayId: membership.team.displayId,
            link: `/admin/teams/${membership.team.id}`,
          })),
          relatedRecordCounts: targetUser._count,
        },
      }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: targetUser.id } })
    await tx.notification.deleteMany({ where: { userId: targetUser.id } })
    await tx.userPermission.deleteMany({ where: { userId: targetUser.id } })
    await tx.user.delete({ where: { id: targetUser.id } })
  })

  await logAuditAction(args.actor.id, 'USER_DELETED', 'User', targetUser.id, {
    deletedUserEmail: targetUser.email,
    deletedUserRole: targetUser.role,
    before: {
      email: targetUser.email,
      role: targetUser.role,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
    },
  })

  return {
    id: targetUser.id,
    email: targetUser.email,
    role: targetUser.role,
  }
}
