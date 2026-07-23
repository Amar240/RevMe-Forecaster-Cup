import type { Prisma } from '@prisma/client'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getArchiveDownloadUrl } from '@/lib/archive'
import { logAuditAction } from '@/lib/audit'
import { prisma } from '@/server/db'
import { ApiError, jsonError, jsonOk, parseJson, requireAdminOrResponse } from '@/server/http'

export const dynamic = 'force-dynamic'

const wipeSeasonSchema = z.object({
  confirmSeasonName: z.string().min(1),
})

type Tx = Prisma.TransactionClient

type SupportTicketSnapshot = {
  id: string
  createdById: string
  supervisorId: string | null
  assignedToId: string | null
  escalatedById: string | null
}

function collectNonNullIds(...values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value))
}

function getJoinRequestWhere(seasonId: string, teamIds: string[]): Prisma.JoinRequestWhereInput {
  if (teamIds.length === 0) {
    return { seasonId }
  }

  return {
    OR: [{ teamId: { in: teamIds } }, { seasonId }],
  }
}

function getSupportTicketWhere(seasonId: string, teamIds: string[]): Prisma.SupportTicketWhereInput {
  if (teamIds.length === 0) {
    return { seasonId }
  }

  return {
    OR: [{ teamId: { in: teamIds } }, { seasonId }],
  }
}

async function collectCandidateUserIds(
  tx: Tx,
  args: {
    seasonId: string
    teamIds: string[]
    supportTickets: SupportTicketSnapshot[]
  }
) {
  const { seasonId, teamIds, supportTickets } = args
  const supportTicketIds = supportTickets.map((ticket) => ticket.id)

  const [teams, teamMembers, submissions, joinRequests, replies] = await Promise.all([
    tx.team.findMany({
      where: { seasonId },
      select: { supervisorId: true },
    }),
    teamIds.length > 0
      ? tx.teamMember.findMany({
          where: { teamId: { in: teamIds } },
          select: { userId: true },
        })
      : Promise.resolve([]),
    tx.submission.findMany({
      where: {
        round: {
          seasonId,
        },
      },
      select: { submittedById: true },
    }),
    tx.joinRequest.findMany({
      where: getJoinRequestWhere(seasonId, teamIds),
      select: {
        studentId: true,
        supervisorId: true,
      },
    }),
    supportTicketIds.length > 0
      ? tx.supportTicketReply.findMany({
          where: { ticketId: { in: supportTicketIds } },
          select: { authorId: true },
        })
      : Promise.resolve([]),
  ])

  const candidatePool = new Set<string>()

  teams.forEach((team) => {
    collectNonNullIds(team.supervisorId).forEach((id) => candidatePool.add(id))
  })
  teamMembers.forEach((member) => candidatePool.add(member.userId))
  submissions.forEach((submission) => candidatePool.add(submission.submittedById))
  joinRequests.forEach((request) => {
    collectNonNullIds(request.studentId, request.supervisorId).forEach((id) => candidatePool.add(id))
  })
  supportTickets.forEach((ticket) => {
    collectNonNullIds(
      ticket.createdById,
      ticket.supervisorId,
      ticket.assignedToId,
      ticket.escalatedById
    ).forEach((id) => candidatePool.add(id))
  })
  replies.forEach((reply) => candidatePool.add(reply.authorId))

  if (candidatePool.size === 0) {
    return []
  }

  const candidates = await tx.user.findMany({
    where: {
      id: { in: Array.from(candidatePool) },
      role: { in: ['STUDENT', 'SUPERVISOR'] },
    },
    select: { id: true },
  })

  return candidates.map((candidate) => candidate.id)
}

async function getSurvivingReferencedUserIds(tx: Tx, candidateUserIds: string[]) {
  if (candidateUserIds.length === 0) {
    return new Set<string>()
  }

  const [
    teamMembers,
    teams,
    submissions,
    joinRequests,
    supportTickets,
    ticketReplies,
    actuals,
    actualRevisions,
    rounds,
    marketInfos,
    marketRoundUpdates,
  ] = await Promise.all([
    tx.teamMember.findMany({
      where: { userId: { in: candidateUserIds } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    tx.team.findMany({
      where: {
        OR: [
          { supervisorId: { in: candidateUserIds } },
          { approvedById: { in: candidateUserIds } },
        ],
      },
      select: {
        supervisorId: true,
        approvedById: true,
      },
    }),
    tx.submission.findMany({
      where: { submittedById: { in: candidateUserIds } },
      select: { submittedById: true },
      distinct: ['submittedById'],
    }),
    tx.joinRequest.findMany({
      where: {
        OR: [
          { studentId: { in: candidateUserIds } },
          { supervisorId: { in: candidateUserIds } },
        ],
      },
      select: {
        studentId: true,
        supervisorId: true,
      },
    }),
    tx.supportTicket.findMany({
      where: {
        OR: [
          { createdById: { in: candidateUserIds } },
          { supervisorId: { in: candidateUserIds } },
          { assignedToId: { in: candidateUserIds } },
          { escalatedById: { in: candidateUserIds } },
        ],
      },
      select: {
        createdById: true,
        supervisorId: true,
        assignedToId: true,
        escalatedById: true,
      },
    }),
    tx.supportTicketReply.findMany({
      where: { authorId: { in: candidateUserIds } },
      select: { authorId: true },
      distinct: ['authorId'],
    }),
    tx.actual.findMany({
      where: {
        OR: [
          { createdById: { in: candidateUserIds } },
          { updatedById: { in: candidateUserIds } },
        ],
      },
      select: {
        createdById: true,
        updatedById: true,
      },
    }),
    tx.actualValueRevision.findMany({
      where: { actorId: { in: candidateUserIds } },
      select: { actorId: true },
      distinct: ['actorId'],
    }),
    tx.round.findMany({
      where: {
        OR: [
          { lockedById: { in: candidateUserIds } },
          { lastScoredById: { in: candidateUserIds } },
        ],
      },
      select: {
        lockedById: true,
        lastScoredById: true,
      },
    }),
    tx.marketInfo.findMany({
      where: { updatedById: { in: candidateUserIds } },
      select: { updatedById: true },
      distinct: ['updatedById'],
    }),
    tx.marketRoundUpdate.findMany({
      where: { createdById: { in: candidateUserIds } },
      select: { createdById: true },
      distinct: ['createdById'],
    }),
  ])

  const survivingUserIds = new Set<string>()

  teamMembers.forEach((member) => survivingUserIds.add(member.userId))
  teams.forEach((team) => {
    collectNonNullIds(team.supervisorId, team.approvedById).forEach((id) => survivingUserIds.add(id))
  })
  submissions.forEach((submission) => survivingUserIds.add(submission.submittedById))
  joinRequests.forEach((request) => {
    collectNonNullIds(request.studentId, request.supervisorId).forEach((id) => survivingUserIds.add(id))
  })
  supportTickets.forEach((ticket) => {
    collectNonNullIds(
      ticket.createdById,
      ticket.supervisorId,
      ticket.assignedToId,
      ticket.escalatedById
    ).forEach((id) => survivingUserIds.add(id))
  })
  ticketReplies.forEach((reply) => survivingUserIds.add(reply.authorId))
  actuals.forEach((actual) => {
    collectNonNullIds(actual.createdById, actual.updatedById).forEach((id) => survivingUserIds.add(id))
  })
  actualRevisions.forEach((revision) => survivingUserIds.add(revision.actorId))
  rounds.forEach((round) => {
    collectNonNullIds(round.lockedById, round.lastScoredById).forEach((id) => survivingUserIds.add(id))
  })
  marketInfos.forEach((marketInfo) => {
    collectNonNullIds(marketInfo.updatedById).forEach((id) => survivingUserIds.add(id))
  })
  marketRoundUpdates.forEach((update) => survivingUserIds.add(update.createdById))

  return survivingUserIds
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdminOrResponse()
    if (response) return response

    const { id } = await params
    const body = await parseJson(request, wipeSeasonSchema)

    const season = await prisma.season.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
      },
    })

    if (!season) {
      throw new ApiError('Season not found', 404, 'NOT_FOUND')
    }

    if (season.status !== 'COMPLETED') {
      throw new ApiError('Only completed seasons can be wiped', 400, 'INVALID_INPUT')
    }

    const latestArchive = await prisma.seasonArchive.findFirst({
      where: { seasonId: id },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        version: true,
        s3Bucket: true,
        s3Prefix: true,
      },
    })

    if (!latestArchive) {
      throw new ApiError('Season must be archived before wiping', 400, 'INVALID_INPUT')
    }

    if (latestArchive.status !== 'COMPLETED') {
      throw new ApiError('Latest archive must be completed before wiping', 409, 'CONFLICT')
    }

    if (body.confirmSeasonName !== season.name) {
      throw new ApiError('Season name confirmation does not match', 400, 'INVALID_INPUT')
    }

    try {
      await getArchiveDownloadUrl(latestArchive, 'participants.csv')
      await getArchiveDownloadUrl(latestArchive, 'results.csv')
    } catch (error) {
      throw new ApiError(
        `Archive files must be downloadable before wiping: ${error instanceof Error ? error.message : String(error)}`,
        409,
        'CONFLICT'
      )
    }

    const deletedCounts = await prisma.$transaction(async (tx) => {
      const teams = await tx.team.findMany({
        where: { seasonId: id },
        select: { id: true },
      })
      const rounds = await tx.round.findMany({
        where: { seasonId: id },
        select: { id: true },
      })

      const teamIds = teams.map((team) => team.id)
      const roundIds = rounds.map((round) => round.id)
      const supportTicketWhere = getSupportTicketWhere(id, teamIds)
      const joinRequestWhere = getJoinRequestWhere(id, teamIds)

      const supportTickets = await tx.supportTicket.findMany({
        where: supportTicketWhere,
        select: {
          id: true,
          createdById: true,
          supervisorId: true,
          assignedToId: true,
          escalatedById: true,
        },
      })

      const supportTicketIds = supportTickets.map((ticket) => ticket.id)
      const candidateUserIds = await collectCandidateUserIds(tx, {
        seasonId: id,
        teamIds,
        supportTickets,
      })

      const emailDispatchWhere: Prisma.EmailDispatchWhereInput | undefined =
        teamIds.length > 0 || roundIds.length > 0
          ? {
              OR: [
                ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
                ...(roundIds.length > 0 ? [{ roundId: { in: roundIds } }] : []),
              ],
            }
          : undefined

      const supportTicketReplies = supportTicketIds.length > 0
        ? await tx.supportTicketReply.deleteMany({
            where: { ticketId: { in: supportTicketIds } },
          })
        : { count: 0 }

      const supportTicketsDeleted = await tx.supportTicket.deleteMany({
        where: supportTicketWhere,
      })
      const joinRequests = await tx.joinRequest.deleteMany({
        where: joinRequestWhere,
      })
      const warnings = teamIds.length > 0
        ? await tx.warning.deleteMany({
            where: { teamId: { in: teamIds } },
          })
        : { count: 0 }
      const scoreAggregates = await tx.scoreAggregate.deleteMany({
        where: { seasonId: id },
      })
      const predictionErrors = await tx.predictionError.deleteMany({
        where: { seasonId: id },
      })
      const scoringRuns = await tx.scoringRun.deleteMany({
        where: { seasonId: id },
      })
      const submissionValues = await tx.submissionValue.deleteMany({
        where: {
          submission: {
            round: {
              seasonId: id,
            },
          },
        },
      })
      const submissions = await tx.submission.deleteMany({
        where: {
          round: {
            seasonId: id,
          },
        },
      })
      const actuals = await tx.actual.deleteMany({
        where: { seasonId: id },
      })
      const marketRoundUpdates = await tx.marketRoundUpdate.deleteMany({
        where: { seasonId: id },
      })
      const marketInfos = await tx.marketInfo.deleteMany({
        where: { seasonId: id },
      })
      const teamMembers = teamIds.length > 0
        ? await tx.teamMember.deleteMany({
            where: { teamId: { in: teamIds } },
          })
        : { count: 0 }
      const teamsDeleted = await tx.team.deleteMany({
        where: { seasonId: id },
      })
      const emailDispatches = emailDispatchWhere
        ? await tx.emailDispatch.deleteMany({ where: emailDispatchWhere })
        : { count: 0 }

      const survivingReferencedUserIds = await getSurvivingReferencedUserIds(tx, candidateUserIds)
      const deletableUserIds = candidateUserIds.filter((userId) => !survivingReferencedUserIds.has(userId))
      const preservedUserIds = candidateUserIds.filter((userId) => survivingReferencedUserIds.has(userId))

      const cannedResponses = deletableUserIds.length > 0
        ? await tx.cannedResponse.deleteMany({
            where: { createdById: { in: deletableUserIds } },
          })
        : { count: 0 }
      const sessions = deletableUserIds.length > 0
        ? await tx.session.deleteMany({
            where: { userId: { in: deletableUserIds } },
          })
        : { count: 0 }
      const notifications = deletableUserIds.length > 0
        ? await tx.notification.deleteMany({
            where: { userId: { in: deletableUserIds } },
          })
        : { count: 0 }
      const userPermissions = deletableUserIds.length > 0
        ? await tx.userPermission.deleteMany({
            where: { userId: { in: deletableUserIds } },
          })
        : { count: 0 }
      const usersDeleted = deletableUserIds.length > 0
        ? await tx.user.deleteMany({
            where: {
              id: { in: deletableUserIds },
              role: { in: ['STUDENT', 'SUPERVISOR'] },
            },
          })
        : { count: 0 }

      return {
        supportTicketReplies: supportTicketReplies.count,
        supportTickets: supportTicketsDeleted.count,
        joinRequests: joinRequests.count,
        warnings: warnings.count,
        scoreAggregates: scoreAggregates.count,
        predictionErrors: predictionErrors.count,
        scoringRuns: scoringRuns.count,
        submissionValues: submissionValues.count,
        submissions: submissions.count,
        actuals: actuals.count,
        marketRoundUpdates: marketRoundUpdates.count,
        marketInfos: marketInfos.count,
        teamMembers: teamMembers.count,
        teams: teamsDeleted.count,
        emailDispatches: emailDispatches.count,
        candidateUsers: candidateUserIds.length,
        preservedUsers: preservedUserIds.length,
        users: usersDeleted.count,
        cannedResponses: cannedResponses.count,
        sessions: sessions.count,
        notifications: notifications.count,
        userPermissions: userPermissions.count,
      }
    })

    await logAuditAction(user!.id, 'SEASON_WIPED', 'Season', season.id, {
      seasonName: season.name,
      archiveVersion: latestArchive.version,
      deletedCounts,
    })

    return jsonOk({
      success: true,
      deletedCounts,
    })
  } catch (error) {
    return jsonError(error, 'Failed to wipe season data')
  }
}
