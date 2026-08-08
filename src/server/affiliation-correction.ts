import { Prisma, type User } from '@prisma/client'
import { buildAuditLogData } from '@/lib/audit'
import { prisma } from '@/server/db'
import { ApiError } from '@/server/http'

type DbClient = Prisma.TransactionClient | typeof prisma
type AffiliationActor = Pick<User, 'id' | 'email' | 'role'>

export type AffiliationCorrectionBlocker = {
  code: 'TEAMS' | 'IMPORT_BATCHES' | 'JOIN_REQUESTS' | 'SUPPORT_TICKETS'
  count: number
  message: string
  link: string
}

export async function getSupervisorSelfCorrectionEligibility(userId: string, db: DbClient = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, universityId: true },
  })
  if (!user || user.role !== 'SUPERVISOR') return null

  const [teams, importBatches, joinRequests, supportTickets] = await Promise.all([
    db.team.count({ where: { supervisorId: user.id } }),
    db.importBatch.count({ where: { uploaderId: user.id } }),
    db.joinRequest.count({
      where: {
        status: 'PENDING',
        OR: [
          { supervisorId: user.id },
          { supervisorEmailEntered: { equals: user.email, mode: 'insensitive' } },
        ],
      },
    }),
    db.supportTicket.count({
      where: {
        status: { not: 'RESOLVED' },
        OR: [{ supervisorId: user.id }, { assignedToId: user.id }],
      },
    }),
  ])

  const blockers: AffiliationCorrectionBlocker[] = []
  if (teams > 0) blockers.push({ code: 'TEAMS', count: teams, message: `${teams} team${teams === 1 ? '' : 's'} are linked to this account.`, link: '/supervisor/teams' })
  if (importBatches > 0) blockers.push({ code: 'IMPORT_BATCHES', count: importBatches, message: `${importBatches} roster import${importBatches === 1 ? '' : 's'} must retain this affiliation history.`, link: '/supervisor/import' })
  if (joinRequests > 0) blockers.push({ code: 'JOIN_REQUESTS', count: joinRequests, message: `${joinRequests} pending join request${joinRequests === 1 ? '' : 's'} are addressed to this account.`, link: '/supervisor/join-requests' })
  if (supportTickets > 0) blockers.push({ code: 'SUPPORT_TICKETS', count: supportTickets, message: `${supportTickets} unresolved support ticket${supportTickets === 1 ? '' : 's'} are linked to this account.`, link: '/supervisor/support' })

  return {
    eligible: blockers.length === 0,
    currentUniversityId: user.universityId,
    blockers,
  }
}

export async function selfCorrectSupervisorAffiliation(args: {
  actor: AffiliationActor
  targetUniversityId: string
  reason: string
}) {
  if (args.actor.role !== 'SUPERVISOR') {
    throw new ApiError('Only supervisors can correct their own university affiliation.', 403, 'FORBIDDEN')
  }
  const reason = args.reason.trim().replace(/\s+/g, ' ')
  if (reason.length < 5 || reason.length > 500) {
    throw new ApiError('Reason must be between 5 and 500 characters.', 400, 'INVALID_INPUT')
  }

  return prisma.$transaction(async (tx) => {
    const eligibility = await getSupervisorSelfCorrectionEligibility(args.actor.id, tx)
    if (!eligibility) throw new ApiError('Supervisor account not found.', 404, 'NOT_FOUND')
    if (!eligibility.eligible) {
      throw new ApiError(
        'Your university must be corrected by an administrator because related records already exist.',
        409,
        'CONFLICT',
        { affiliationCorrection: eligibility }
      )
    }
    if (eligibility.currentUniversityId === args.targetUniversityId) {
      throw new ApiError('Select a different university.', 422, 'INVALID_INPUT')
    }

    const targetUniversity = await tx.university.findFirst({
      where: { id: args.targetUniversityId, isListed: true },
      select: { id: true, name: true, country: true },
    })
    if (!targetUniversity) throw new ApiError('Select an approved university.', 422, 'INVALID_INPUT')

    const updated = await tx.user.update({
      where: { id: args.actor.id },
      data: { universityId: targetUniversity.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        universityId: true,
        university: { select: { id: true, name: true, country: true } },
      },
    })
    await tx.auditLog.create({
      data: buildAuditLogData(args.actor, 'SUPERVISOR_SELF_AFFILIATION_CORRECTED', 'User', updated.id, {
        details: { reason },
        before: { universityId: eligibility.currentUniversityId },
        after: { universityId: targetUniversity.id },
      }),
    })
    return updated
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
