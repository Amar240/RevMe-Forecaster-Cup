import crypto from 'crypto'
import { Prisma, type User } from '@prisma/client'
import { buildAuditLogData } from '@/lib/audit'
import { runArchiveJob } from '@/lib/archive'
import { logger } from '@/lib/logger'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'
import {
  CURRENT_SUPERVISOR_SEASON_STATUSES,
  CURRENT_SUPERVISOR_TEAM_STATUSES,
} from '@/server/team-supervisor-assignment'

type DbClient = Prisma.TransactionClient | typeof prisma
type CorrectionActor = Pick<User, 'id' | 'email' | 'role'>

const correctionTeamSelect = {
  id: true,
  name: true,
  displayId: true,
  status: true,
  seasonId: true,
  universityId: true,
  supervisorId: true,
  updatedAt: true,
  university: { select: { id: true, name: true } },
  season: { select: { id: true, name: true, status: true } },
  members: {
    select: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          universityId: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.TeamSelect

function fingerprint(value: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function requireFullAdmin(actor: CorrectionActor) {
  if (actor.role !== 'ADMIN') {
    throw new ApiError('Only full administrators can correct university affiliations.', 403, 'FORBIDDEN')
  }
}

async function buildCorrectionPreflight(args: {
  supervisorId: string
  targetUniversityId: string
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
      university: { select: { id: true, name: true, country: true } },
    },
  })
  if (!supervisor || supervisor.role !== 'SUPERVISOR') {
    throw new ApiError('Supervisor not found', 404, 'NOT_FOUND')
  }
  if (supervisor.universityId === args.targetUniversityId) {
    throw new ApiError('Select a different university.', 422, 'INVALID_INPUT')
  }

  const targetUniversity = await args.db.university.findFirst({
    where: { id: args.targetUniversityId, isListed: true },
    select: { id: true, name: true, country: true },
  })
  if (!targetUniversity) throw new ApiError('Select an approved university.', 422, 'INVALID_INPUT')

  const affectedTeams = await args.db.team.findMany({
    where: { supervisorId: supervisor.id },
    select: correctionTeamSelect,
    orderBy: [{ season: { startDate: 'desc' } }, { name: 'asc' }],
  })
  const affectedTeamIds = affectedTeams.map((team) => team.id)
  const studentMap = new Map<string, (typeof affectedTeams)[number]['members'][number]['user']>()
  for (const team of affectedTeams) {
    for (const member of team.members) studentMap.set(member.user.id, member.user)
  }
  const affectedStudents = [...studentMap.values()].sort((left, right) => left.email.localeCompare(right.email))

  const conflictingMemberships = affectedStudents.length === 0
    ? []
    : await args.db.teamMember.findMany({
        where: {
          userId: { in: affectedStudents.map((student) => student.id) },
          ...(affectedTeamIds.length > 0 ? { teamId: { notIn: affectedTeamIds } } : {}),
          team: {
            status: { in: [...CURRENT_SUPERVISOR_TEAM_STATUSES] },
            OR: [
              { seasonId: null },
              { season: { status: { in: [...CURRENT_SUPERVISOR_SEASON_STATUSES] } } },
            ],
          },
        },
        select: {
          userId: true,
          team: {
            select: {
              id: true,
              name: true,
              displayId: true,
              universityId: true,
              university: { select: { name: true } },
              season: { select: { id: true, name: true, status: true } },
            },
          },
        },
      })

  const conflictStudentIds = new Set(conflictingMemberships.map((membership) => membership.userId))
  const studentConflicts = affectedStudents
    .filter((student) => conflictStudentIds.has(student.id))
    .map((student) => ({
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
      },
      outsideTeams: conflictingMemberships
        .filter((membership) => membership.userId === student.id)
        .map((membership) => membership.team),
    }))

  const completedSeasonIds = [...new Set(
    affectedTeams
      .filter((team) => team.season?.status === 'COMPLETED' && team.seasonId)
      .map((team) => team.seasonId!)
  )]
  const publishedLeaderboardRounds = affectedTeamIds.length === 0
    ? 0
    : await args.db.round.count({
        where: {
          leaderboardVisible: true,
          season: { teams: { some: { id: { in: affectedTeamIds } } } },
        },
      })
  const activeTeams = affectedTeams.filter(
    (team) => team.status === 'ACTIVE' && (!team.season || team.season.status !== 'COMPLETED')
  )
  const activeMemberIds = new Set(activeTeams.flatMap((team) => team.members.map((member) => member.user.id)))

  const stateFingerprint = fingerprint({
    targetUniversityId: targetUniversity.id,
    supervisor: {
      id: supervisor.id,
      universityId: supervisor.universityId,
      updatedAt: supervisor.updatedAt.toISOString(),
    },
    teams: affectedTeams.map((team) => ({
      id: team.id,
      universityId: team.universityId,
      supervisorId: team.supervisorId,
      status: team.status,
      seasonId: team.seasonId,
      updatedAt: team.updatedAt.toISOString(),
      memberIds: team.members.map((member) => member.user.id).sort(),
    })),
    students: affectedStudents.map((student) => ({
      id: student.id,
      universityId: student.universityId,
      updatedAt: student.updatedAt.toISOString(),
    })),
    conflicts: conflictingMemberships.map((membership) => ({
      userId: membership.userId,
      teamId: membership.team.id,
      universityId: membership.team.universityId,
    })).sort((left, right) => `${left.userId}:${left.teamId}`.localeCompare(`${right.userId}:${right.teamId}`)),
  })

  return {
    operation: 'CORRECT_AFFILIATION' as const,
    supervisor,
    sourceUniversity: supervisor.university,
    targetUniversity,
    affectedTeams: affectedTeams.map((team) => ({ ...team, members: team.members.map((member) => member.user) })),
    affectedStudents,
    studentConflicts,
    impacts: {
      publishedLeaderboardRounds,
      completedSeasons: completedSeasonIds.map((seasonId) => {
        const season = affectedTeams.find((team) => team.seasonId === seasonId)?.season
        return { id: seasonId, name: season?.name ?? 'Completed season' }
      }),
      supervisorNotifications: 1,
      participantNotifications: activeMemberIds.size,
    },
    fingerprint: stateFingerprint,
  }
}

export async function getSupervisorAffiliationCorrectionPreflight(args: {
  actor: CorrectionActor
  supervisorId: string
  targetUniversityId: string
}) {
  requireFullAdmin(args.actor)
  return buildCorrectionPreflight({ ...args, db: prisma })
}

export async function executeSupervisorAffiliationCorrection(args: {
  actor: CorrectionActor
  supervisorId: string
  targetUniversityId: string
  typedTargetUniversityName: string
  reason: string
  fingerprint: string
}) {
  requireFullAdmin(args.actor)
  const reason = args.reason.trim().replace(/\s+/g, ' ')
  if (reason.length < 5 || reason.length > 500) {
    throw new ApiError('Reason must be between 5 and 500 characters.', 400, 'INVALID_INPUT')
  }

  const result = await prisma.$transaction(async (tx) => {
    const preflight = await buildCorrectionPreflight({
      supervisorId: args.supervisorId,
      targetUniversityId: args.targetUniversityId,
      db: tx,
    })
    if (preflight.fingerprint !== args.fingerprint) {
      throw new ApiError('Affiliation data changed after this review was prepared. Refresh and review again.', 409, 'CONFLICT')
    }
    if (args.typedTargetUniversityName.trim() !== preflight.targetUniversity.name) {
      throw new ApiError('Enter the exact target university name to confirm this correction.', 422, 'INVALID_INPUT')
    }
    if (preflight.studentConflicts.length > 0) {
      throw new ApiError(
        'Some students belong to current teams outside this correction. Resolve those memberships first.',
        409,
        'CONFLICT',
        { studentConflicts: preflight.studentConflicts }
      )
    }

    const correctedAt = new Date()
    const oldUniversityId = preflight.supervisor.universityId
    await tx.user.update({
      where: { id: preflight.supervisor.id },
      data: { universityId: preflight.targetUniversity.id },
    })
    if (preflight.affectedTeams.length > 0) {
      await tx.team.updateMany({
        where: { id: { in: preflight.affectedTeams.map((team) => team.id) } },
        data: { universityId: preflight.targetUniversity.id },
      })
    }
    if (preflight.affectedStudents.length > 0) {
      await tx.user.updateMany({
        where: { id: { in: preflight.affectedStudents.map((student) => student.id) } },
        data: { universityId: preflight.targetUniversity.id },
      })
    }

    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'SUPERVISOR_AFFILIATION_CORRECTION_COMPLETED', 'User', preflight.supervisor.id, {
        details: {
          reason,
          correctedAt: correctedAt.toISOString(),
          affectedTeamIds: preflight.affectedTeams.map((team) => team.id),
          affectedStudentIds: preflight.affectedStudents.map((student) => student.id),
          completedSeasonIds: preflight.impacts.completedSeasons.map((season) => season.id),
        },
        before: { universityId: oldUniversityId },
        after: { universityId: preflight.targetUniversity.id },
      }),
    })
    for (const team of preflight.affectedTeams) {
      await tx.auditLog.create({
        data: buildAuditLogData(args.actor, 'TEAM_AFFILIATION_CORRECTED', 'Team', team.id, {
          details: { reason, supervisorId: preflight.supervisor.id, correctedAt: correctedAt.toISOString() },
          before: { universityId: team.universityId },
          after: { universityId: preflight.targetUniversity.id },
        }),
      })
    }
    for (const student of preflight.affectedStudents) {
      await tx.auditLog.create({
        data: buildAuditLogData(args.actor, 'STUDENT_AFFILIATION_CORRECTED', 'User', student.id, {
          details: { reason, supervisorId: preflight.supervisor.id, correctedAt: correctedAt.toISOString() },
          before: { universityId: student.universityId },
          after: { universityId: preflight.targetUniversity.id },
        }),
      })
    }

    await tx.notification.create({
      data: {
        userId: preflight.supervisor.id,
        type: 'SUPERVISOR_AFFILIATION_CORRECTED',
        title: 'Your university affiliation was corrected',
        message: `Your account and teams are now affiliated with ${preflight.targetUniversity.name}.`,
        link: '/settings',
      },
    })
    const activeMemberIds = [...new Set(
      preflight.affectedTeams
        .filter((team) => team.status === 'ACTIVE' && (!team.season || team.season.status !== 'COMPLETED'))
        .flatMap((team) => team.members.map((member) => member.id))
    )]
    if (activeMemberIds.length > 0) {
      await tx.notification.createMany({
        data: activeMemberIds.map((userId) => ({
          userId,
          type: 'TEAM_AFFILIATION_CORRECTED',
          title: 'Your team university was corrected',
          message: `Your team is now affiliated with ${preflight.targetUniversity.name}. Forecasts and scores are unchanged.`,
          link: '/dashboard',
        })),
      })
    }

    return {
      supervisor: {
        id: preflight.supervisor.id,
        universityId: preflight.targetUniversity.id,
        university: preflight.targetUniversity,
      },
      affectedTeamCount: preflight.affectedTeams.length,
      affectedStudentCount: preflight.affectedStudents.length,
      completedSeasonIds: preflight.impacts.completedSeasons.map((season) => season.id),
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  const archiveResults = await Promise.all(result.completedSeasonIds.map(async (seasonId) => {
    try {
      const archive = await runArchiveJob(seasonId, args.actor.id)
      return { seasonId, status: 'COMPLETED' as const, archiveId: archive.id, version: archive.version }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Archive generation failed'
      logger.error('Affiliation correction archive regeneration failed', { seasonId, message })
      return { seasonId, status: 'FAILED' as const, message, retryable: true }
    }
  }))

  return { ...result, archiveResults }
}
