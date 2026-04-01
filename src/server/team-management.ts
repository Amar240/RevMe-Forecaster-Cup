import crypto from 'crypto'
import { Prisma, TeamStatus, User } from '@prisma/client'
import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import { sameUniversity } from '@/server/universities'

type DbClient = Prisma.TransactionClient | typeof prisma
type TeamManagementActor = Pick<User, 'id' | 'email' | 'role'>

type UniversityRecord = {
  id?: string | null
  name?: string | null
  normalizedName?: string | null
}

const universitySelect = {
  id: true,
  name: true,
  normalizedName: true,
} satisfies Prisma.UniversitySelect

const supervisorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  universityId: true,
  university: {
    select: universitySelect,
  },
  _count: {
    select: {
      supervisedTeams: true,
    },
  },
} satisfies Prisma.UserSelect

const teamMutationSelect = Prisma.validator<Prisma.TeamSelect>()({
  id: true,
  name: true,
  displayId: true,
  externalTeamId: true,
  status: true,
  seasonId: true,
  universityId: true,
  supervisorId: true,
})

const teamLifecycleSelect = Prisma.validator<Prisma.TeamSelect>()({
  id: true,
  name: true,
  displayId: true,
  externalTeamId: true,
  status: true,
  seasonId: true,
  universityId: true,
  supervisorId: true,
  approvedAt: true,
  approvedById: true,
  rejectionReason: true,
  disqualifiedAt: true,
  disqualifiedReason: true,
  season: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  university: {
    select: universitySelect,
  },
  supervisor: {
    select: supervisorSelect,
  },
  members: {
    select: {
      id: true,
      userId: true,
      isSubmitter: true,
    },
  },
})

type ManagedTeam = Prisma.TeamGetPayload<{
  select: typeof teamMutationSelect
}>

type TeamLifecycleRecord = Prisma.TeamGetPayload<{
  select: typeof teamLifecycleSelect
}>

type TeamStatusAction = 'archive' | 'restore-draft' | 'activate'

const TEAM_SUPERVISOR_CAP = 10
const archivableStatuses = new Set<TeamStatus>(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE'])

export function normalizeTeamName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeExternalTeamId(value?: string | null) {
  const nextValue = value?.trim().replace(/\s+/g, ' ') ?? ''
  return nextValue || null
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

async function requireSeason(seasonId: string, db: DbClient) {
  const season = await db.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  })

  if (!season) {
    throw new ApiError('Season not found', 404, 'NOT_FOUND')
  }

  if (season.status === 'COMPLETED') {
    throw new ApiError('Completed seasons cannot be used for manual team management.', 422, 'INVALID_INPUT')
  }

  return season
}

async function generateDisplayId(db: DbClient) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `T-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
    const existing = await db.team.findUnique({
      where: { displayId: candidate },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }
  }

  throw new ApiError('Could not generate a unique team identifier.', 500, 'INTERNAL_ERROR')
}

export async function ensureUniqueTeamName(args: {
  name: string
  teamId?: string
  db?: DbClient
}) {
  const db = args.db ?? prisma
  const existingTeam = await db.team.findFirst({
    where: {
      ...(args.teamId ? { id: { not: args.teamId } } : {}),
      name: { equals: args.name, mode: 'insensitive' },
    },
    select: { id: true },
  })

  if (existingTeam) {
    throw new ApiError('A team with this name already exists. Please choose a different name.', 422, 'CONFLICT')
  }
}

async function ensureUniqueExternalTeamId(args: {
  seasonId: string
  externalTeamId: string | null
  teamId?: string
  db?: DbClient
}) {
  if (!args.externalTeamId) {
    return
  }

  const db = args.db ?? prisma
  const existingTeam = await db.team.findFirst({
    where: {
      seasonId: args.seasonId,
      externalTeamId: args.externalTeamId,
      ...(args.teamId ? { id: { not: args.teamId } } : {}),
    },
    select: { id: true },
  })

  if (existingTeam) {
    throw new ApiError(
      'That external team ID is already used in the selected season. Choose a different identifier.',
      422,
      'CONFLICT'
    )
  }
}

export async function resolveAssignableSupervisor(args: {
  supervisorId: string
  university: UniversityRecord
  teamIdToExclude?: string
  db?: DbClient
}) {
  const db = args.db ?? prisma

  const supervisor = await db.user.findUnique({
    where: { id: args.supervisorId },
    select: supervisorSelect,
  })

  if (!supervisor) {
    throw new ApiError('Supervisor not found', 404, 'NOT_FOUND')
  }

  if (supervisor.role !== 'SUPERVISOR') {
    throw new ApiError('Selected user is not a supervisor.', 422, 'INVALID_INPUT')
  }

  if (!supervisor.isActive) {
    throw new ApiError('Inactive supervisors cannot be assigned to teams.', 422, 'INVALID_INPUT')
  }

  if (!supervisor.universityId || !sameUniversity(args.university, supervisor.university)) {
    throw new ApiError('Supervisor must belong to the same university as the team.', 422, 'INVALID_INPUT')
  }

  const teamCount = await db.team.count({
    where: {
      supervisorId: supervisor.id,
      ...(args.teamIdToExclude ? { id: { not: args.teamIdToExclude } } : {}),
    },
  })

  if (teamCount >= TEAM_SUPERVISOR_CAP) {
    throw new ApiError(`Supervisor already manages the maximum of ${TEAM_SUPERVISOR_CAP} teams.`, 422, 'CONFLICT')
  }

  return supervisor
}

async function getLifecycleTeamOrThrow(teamId: string, db: DbClient) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: teamLifecycleSelect,
  })

  if (!team) {
    throw new ApiError('Team not found', 404, 'NOT_FOUND')
  }

  return team
}

export async function createAdminTeam(args: {
  actor: TeamManagementActor
  seasonId: string
  universityId: string
  name: string
  externalTeamId?: string | null
  supervisorId: string
}) {
  const name = normalizeTeamName(args.name)
  if (!name) {
    throw new ApiError('Team name is required.', 400, 'INVALID_INPUT')
  }

  const externalTeamId = normalizeExternalTeamId(args.externalTeamId)
  const [season, university] = await Promise.all([
    requireSeason(args.seasonId, prisma),
    requireUniversity(args.universityId, prisma),
  ])

  await ensureUniqueTeamName({ name })
  await ensureUniqueExternalTeamId({
    seasonId: season.id,
    externalTeamId,
  })
  await resolveAssignableSupervisor({
    supervisorId: args.supervisorId,
    university,
  })

  return prisma.$transaction(async (tx) => {
    const displayId = await generateDisplayId(tx)
    const team = await tx.team.create({
      data: {
        name,
        displayId,
        externalTeamId,
        status: 'DRAFT',
        seasonId: season.id,
        universityId: university.id,
        supervisorId: args.supervisorId,
      },
      select: teamMutationSelect,
    })

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_CREATED', 'Team', team.id, {
        details: {
          displayId: team.displayId,
          externalTeamId: team.externalTeamId,
          seasonId: team.seasonId,
          universityId: team.universityId,
          supervisorId: team.supervisorId,
          status: team.status,
        },
        after: {
          name: team.name,
          displayId: team.displayId,
          externalTeamId: team.externalTeamId,
          status: team.status,
          seasonId: team.seasonId,
          universityId: team.universityId,
          supervisorId: team.supervisorId,
        },
      }),
    })

    return team
  })
}

export async function updateAdminTeamMetadata(args: {
  actor: TeamManagementActor
  teamId: string
  name: string
  externalTeamId?: string | null
}) {
  const currentTeam = await getLifecycleTeamOrThrow(args.teamId, prisma)
  const nextName = normalizeTeamName(args.name)
  if (!nextName) {
    throw new ApiError('Team name is required.', 400, 'INVALID_INPUT')
  }

  const nextExternalTeamId = normalizeExternalTeamId(args.externalTeamId)
  if (!currentTeam.seasonId) {
    throw new ApiError('Teams without a season cannot be updated through this flow.', 422, 'INVALID_INPUT')
  }

  if (nextName !== currentTeam.name) {
    await ensureUniqueTeamName({
      name: nextName,
      teamId: currentTeam.id,
    })
  }

  if (nextExternalTeamId !== currentTeam.externalTeamId) {
    await ensureUniqueExternalTeamId({
      seasonId: currentTeam.seasonId,
      externalTeamId: nextExternalTeamId,
      teamId: currentTeam.id,
    })
  }

  if (nextName === currentTeam.name && nextExternalTeamId === currentTeam.externalTeamId) {
    return currentTeam
  }

  return prisma.$transaction(async (tx) => {
    const updatedTeam = await tx.team.update({
      where: { id: currentTeam.id },
      data: {
        name: nextName,
        externalTeamId: nextExternalTeamId,
      },
      select: teamMutationSelect,
    })

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_UPDATED', 'Team', currentTeam.id, {
        details: {
          previousName: currentTeam.name,
          nextName: updatedTeam.name,
          previousExternalTeamId: currentTeam.externalTeamId,
          nextExternalTeamId: updatedTeam.externalTeamId,
        },
        before: {
          name: currentTeam.name,
          externalTeamId: currentTeam.externalTeamId,
        },
        after: {
          name: updatedTeam.name,
          externalTeamId: updatedTeam.externalTeamId,
        },
      }),
    })

    return updatedTeam
  })
}

function assertCanArchiveTeam(team: Pick<TeamLifecycleRecord, 'status'>) {
  if (!archivableStatuses.has(team.status)) {
    throw new ApiError('This team cannot be archived from its current status.', 422, 'INVALID_INPUT')
  }
}

function assertCanRestoreTeam(team: Pick<TeamLifecycleRecord, 'status'>) {
  if (team.status !== 'ARCHIVED') {
    throw new ApiError('Only archived teams can be restored to draft.', 422, 'INVALID_INPUT')
  }
}

function assertCanActivateTeam(team: TeamLifecycleRecord) {
  if (team.status !== 'DRAFT') {
    throw new ApiError('Only draft teams can be activated.', 422, 'INVALID_INPUT')
  }

  if (!team.seasonId || !team.season || team.season.status === 'COMPLETED') {
    throw new ApiError('Draft teams must belong to a non-completed season before activation.', 422, 'INVALID_INPUT')
  }

  if (!team.supervisorId || !team.supervisor || !team.supervisor.isActive) {
    throw new ApiError('Assign an active supervisor before activating the team.', 422, 'INVALID_INPUT')
  }

  if (team.members.length === 0) {
    throw new ApiError('Add at least one member before activating the team.', 422, 'INVALID_INPUT')
  }

  if (!team.members.some((member) => member.isSubmitter)) {
    throw new ApiError('Choose a submitter before activating the team.', 422, 'INVALID_INPUT')
  }
}

export async function setAdminTeamStatus(args: {
  actor: TeamManagementActor
  teamId: string
  action: TeamStatusAction
}) {
  const currentTeam = await getLifecycleTeamOrThrow(args.teamId, prisma)

  if (args.action === 'archive') {
    assertCanArchiveTeam(currentTeam)

    return prisma.$transaction(async (tx) => {
      const updatedTeam = await tx.team.update({
        where: { id: currentTeam.id },
        data: { status: 'ARCHIVED' },
        select: teamMutationSelect,
      })

      await tx.auditLog.create({
        data: buildAuditLogData(args.actor, 'TEAM_ARCHIVED', 'Team', currentTeam.id, {
          details: {
            previousStatus: currentTeam.status,
            nextStatus: updatedTeam.status,
          },
          before: { status: currentTeam.status },
          after: { status: updatedTeam.status },
        }),
      })

      return updatedTeam
    })
  }

  if (args.action === 'restore-draft') {
    assertCanRestoreTeam(currentTeam)

    return prisma.$transaction(async (tx) => {
      const updatedTeam = await tx.team.update({
        where: { id: currentTeam.id },
        data: {
          status: 'DRAFT',
          approvedAt: null,
          approvedById: null,
          rejectionReason: null,
          disqualifiedAt: null,
          disqualifiedReason: null,
        },
        select: teamMutationSelect,
      })

      await tx.auditLog.create({
        data: buildAuditLogData(args.actor, 'TEAM_RESTORED_TO_DRAFT', 'Team', currentTeam.id, {
          details: {
            previousStatus: currentTeam.status,
            nextStatus: updatedTeam.status,
          },
          before: { status: currentTeam.status },
          after: { status: updatedTeam.status },
        }),
      })

      return updatedTeam
    })
  }

  assertCanActivateTeam(currentTeam)

  return prisma.$transaction(async (tx) => {
    const updatedTeam = await tx.team.update({
      where: { id: currentTeam.id },
      data: {
        status: 'ACTIVE',
        approvedAt: new Date(),
        approvedById: args.actor.id,
        rejectionReason: null,
      },
      select: teamMutationSelect,
    })

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'TEAM_ACTIVATED', 'Team', currentTeam.id, {
        details: {
          previousStatus: currentTeam.status,
          nextStatus: updatedTeam.status,
        },
        before: { status: currentTeam.status },
        after: { status: updatedTeam.status },
      }),
    })

    return updatedTeam
  })
}

export { TEAM_SUPERVISOR_CAP }
