import { Prisma, type TeamStatus, type User } from '@prisma/client'
import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'

type DbClient = Prisma.TransactionClient | typeof prisma
type CleanupActor = Pick<User, 'id' | 'email' | 'role'>

const DELETABLE_TEAM_STATUSES: TeamStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'REJECTED',
  'ARCHIVED',
]

export type TeamDeletionBlocker = {
  code: string
  count: number
  message: string
  action: 'ARCHIVE' | 'REVIEW_RECORDS' | 'NONE'
}

async function getEligibility(teamId: string, db: DbClient) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      name: true,
      displayId: true,
      externalTeamId: true,
      status: true,
      seasonId: true,
      universityId: true,
      supervisorId: true,
      importBatchId: true,
      createdAt: true,
      updatedAt: true,
      season: { select: { id: true, name: true, status: true } },
      university: { select: { id: true, name: true } },
      supervisor: { select: { id: true, email: true, firstName: true, lastName: true } },
      members: {
        select: {
          id: true,
          userId: true,
          isSubmitter: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      },
      supervisorAssignments: {
        select: {
          id: true,
          supervisorId: true,
          startedAt: true,
          endedAt: true,
          source: true,
          isApproximate: true,
        },
        orderBy: { startedAt: 'asc' },
      },
      _count: {
        select: {
          submissions: true,
          predictionErrors: true,
          scoreAggregates: true,
          warnings: true,
          supportTickets: true,
        },
      },
    },
  })

  if (!team) throw new ApiError('Team not found', 404, 'NOT_FOUND')

  const [joinRequests, emailDispatches, scoringRuns] = await Promise.all([
    db.joinRequest.count({ where: { teamId: team.id } }),
    db.emailDispatch.count({ where: { teamId: team.id } }),
    db.scoringRun.count({ where: { teamId: team.id } }),
  ])

  const blockers: TeamDeletionBlocker[] = []
  if (!DELETABLE_TEAM_STATUSES.includes(team.status)) {
    blockers.push({
      code: 'TEAM_STATUS',
      count: 1,
      message: 'Only clean draft, pending, approved, active, rejected, or archived teams can be permanently deleted.',
      action: team.status === 'ACTIVE' || team.status === 'APPROVED' ? 'ARCHIVE' : 'NONE',
    })
  }
  if (team.season?.status === 'COMPLETED') {
    blockers.push({
      code: 'COMPLETED_SEASON',
      count: 1,
      message: 'Teams from completed seasons are permanent competition history.',
      action: 'NONE',
    })
  }

  const activity: Array<[string, number, string]> = [
    ['SUBMISSIONS', team._count.submissions, 'forecast submissions'],
    ['PREDICTION_ERRORS', team._count.predictionErrors, 'prediction-error records'],
    ['SCORE_AGGREGATES', team._count.scoreAggregates, 'score records'],
    ['WARNINGS', team._count.warnings, 'competition warnings'],
    ['SUPPORT_TICKETS', team._count.supportTickets, 'support tickets'],
    ['JOIN_REQUESTS', joinRequests, 'join requests'],
    ['EMAIL_DISPATCHES', emailDispatches, 'team email dispatches'],
    ['SCORING_RUNS', scoringRuns, 'team-scoped scoring runs'],
  ]
  for (const [code, count, label] of activity) {
    if (count > 0) {
      blockers.push({
        code,
        count,
        message: `This team has ${count} ${label} and must be archived instead of deleted.`,
        action: 'REVIEW_RECORDS',
      })
    }
  }

  return {
    team,
    eligibility: {
      canDelete: blockers.length === 0,
      blockers,
      memberAccountsPreserved: team.members.length,
    },
  }
}

export async function getTeamDeletionEligibility(teamId: string) {
  const { eligibility } = await getEligibility(teamId, prisma)
  return eligibility
}

export async function deleteCleanTeam(args: {
  actor: CleanupActor
  teamId: string
  confirmDisplayId: string
  reason: string
}) {
  if (args.actor.role !== 'ADMIN') {
    throw new ApiError('Only full administrators can permanently delete teams.', 403, 'FORBIDDEN')
  }
  const reason = args.reason.trim().replace(/\s+/g, ' ')
  if (reason.length < 5 || reason.length > 500) {
    throw new ApiError('Reason must be between 5 and 500 characters.', 400, 'INVALID_INPUT')
  }

  return prisma.$transaction(
    async (tx) => {
      const { team, eligibility } = await getEligibility(args.teamId, tx)
      if (args.confirmDisplayId.trim() !== team.displayId) {
        throw new ApiError('Enter the exact team display ID to confirm deletion.', 422, 'INVALID_INPUT')
      }
      if (!eligibility.canDelete) {
        throw new ApiError(
          'This team contains competition history and cannot be permanently deleted.',
          422,
          'INVALID_INPUT',
          { deletionEligibility: eligibility }
        )
      }

      await tx.auditLog.create({
        data: buildAuditLogData(args.actor, 'TEAM_PERMANENTLY_DELETED', 'Team', team.id, {
          details: {
            reason,
            memberAccountsPreserved: team.members.map((member) => member.userId),
          },
          before: {
            id: team.id,
            name: team.name,
            displayId: team.displayId,
            externalTeamId: team.externalTeamId,
            status: team.status,
            seasonId: team.seasonId,
            universityId: team.universityId,
            supervisorId: team.supervisorId,
            importBatchId: team.importBatchId,
            members: team.members,
            supervisorAssignments: team.supervisorAssignments,
          },
          after: { deleted: true },
        }),
      })
      await tx.team.delete({ where: { id: team.id } })

      return {
        deletedTeam: { id: team.id, name: team.name, displayId: team.displayId },
        preservedUserIds: team.members.map((member) => member.userId),
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  )
}
