import crypto from 'crypto'
import { Prisma, type User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import { closeOpenSupervisorAssignment } from '@/server/team-supervisor-assignment'
import { logAuditAction } from '@/lib/audit'
import { sendAccountActivationEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

type Actor = Pick<User, 'id' | 'email' | 'role'>
const WELCOME_DISPATCH = 'ROSTER_IMPORT_WELCOME'
type BatchSummary = { provisionedByTeam?: Record<string, string[]> }

async function completeBatchIfResolved(batchId: string | null) {
  if (!batchId) return
  const pending = await prisma.team.count({ where: { importBatchId: batchId, status: 'PENDING_APPROVAL' } })
  if (pending === 0) await prisma.importBatch.update({ where: { id: batchId }, data: { status: 'COMPLETED' } })
}

async function activateTeams(actor: Actor, teamIds: string[]) {
  const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, include: { importBatch: { select: { id: true, summaryJson: true } } } })
  if (teams.length !== teamIds.length) throw new ApiError('One or more teams were not found', 404, 'NOT_FOUND')
  if (teams.some((team) => team.status !== 'PENDING_APPROVAL')) throw new ApiError('Every selected team must be pending approval', 422, 'INVALID_INPUT')

  const candidates: Array<{ teamId: string; userId: string; token: string }> = []
  for (const team of teams) {
    const summary = team.importBatch?.summaryJson as BatchSummary | undefined
    for (const userId of summary?.provisionedByTeam?.[team.id] ?? []) candidates.push({ teamId: team.id, userId, token: crypto.randomBytes(32).toString('hex') })
  }
  const claimed: typeof candidates = []
  await prisma.$transaction(async (tx) => {
    await tx.team.updateMany({ where: { id: { in: teamIds }, status: 'PENDING_APPROVAL' }, data: { status: 'ACTIVE', approvedAt: new Date(), approvedById: actor.id, rejectionReason: null } })
    for (const candidate of candidates) {
      const claim = await tx.emailDispatch.createMany({ data: [{ type: WELCOME_DISPATCH, recipientId: candidate.userId, teamId: candidate.teamId, success: false }], skipDuplicates: true })
      if (!claim.count) continue
      await tx.user.update({ where: { id: candidate.userId }, data: { resetToken: candidate.token, resetTokenExpiry: new Date(Date.now() + 72 * 60 * 60 * 1000) } })
      claimed.push(candidate)
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  const users = claimed.length ? await prisma.user.findMany({ where: { id: { in: claimed.map((item) => item.userId) } }, select: { id: true, email: true, firstName: true } }) : []
  const userById = new Map(users.map((user) => [user.id, user]))
  for (const item of claimed) {
    const user = userById.get(item.userId)
    if (!user) continue
    try {
      const success = await sendAccountActivationEmail(user.email, user.firstName, item.token)
      await prisma.emailDispatch.update({ where: { type_recipientId_teamId: { type: WELCOME_DISPATCH, recipientId: item.userId, teamId: item.teamId } }, data: { success } })
    } catch (error) { logger.error('Deferred roster activation email failed', { teamId: item.teamId, userId: item.userId, error }) }
  }
  for (const team of teams) await logAuditAction(actor.id, 'TEAM_APPROVED', 'Team', team.id, { teamName: team.name, importBatchId: team.importBatchId })
  for (const batchId of new Set(teams.map((team) => team.importBatchId).filter((id): id is string => Boolean(id)))) await completeBatchIfResolved(batchId)
  return teams
}

export async function approvePendingTeam(actor: Actor, teamId: string) { await activateTeams(actor, [teamId]) }

export async function approveImportBatch(actor: Actor, batchId: string) {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId }, select: { teams: { where: { status: 'PENDING_APPROVAL' }, select: { id: true } } } })
  if (!batch) throw new ApiError('Import batch not found', 404, 'NOT_FOUND')
  if (!batch.teams.length) throw new ApiError('Import batch has no pending teams', 422, 'INVALID_INPUT')
  await activateTeams(actor, batch.teams.map((team) => team.id))
  await logAuditAction(actor.id, 'IMPORT_BATCH_APPROVED', 'ImportBatch', batchId, { teamCount: batch.teams.length })
}

export async function rejectPendingTeam(actor: Actor, teamId: string, reason: string) {
  const trimmed = reason.trim()
  if (!trimmed) throw new ApiError('A rejection reason is required', 422, 'INVALID_INPUT')
  const team = await prisma.team.findUnique({ where: { id: teamId }, include: { supervisor: { select: { id: true } } } })
  if (!team) throw new ApiError('Team not found', 404, 'NOT_FOUND')
  if (team.status !== 'PENDING_APPROVAL') throw new ApiError('Team is not pending approval', 422, 'INVALID_INPUT')
  await prisma.$transaction(async (tx) => {
    await tx.team.update({ where: { id: teamId }, data: { status: 'REJECTED', rejectionReason: trimmed } })
    await closeOpenSupervisorAssignment({
      teamId,
      endedById: actor.id,
      reason: `Team rejected: ${trimmed}`,
      db: tx,
    })
    if (team.supervisor) await tx.notification.create({ data: { userId: team.supervisor.id, type: 'TEAM_REJECTED', title: `${team.name} was not approved`, message: trimmed, link: '/supervisor/import' } })
  })
  await logAuditAction(actor.id, 'TEAM_REJECTED', 'Team', teamId, { teamName: team.name, reason: trimmed, importBatchId: team.importBatchId })
  await completeBatchIfResolved(team.importBatchId)
}

export async function getPendingApprovalGroups() {
  const teams = await prisma.team.findMany({
    where: { status: 'PENDING_APPROVAL' },
    include: { supervisor: { select: { id: true, firstName: true, lastName: true, email: true } }, university: { select: { id: true, name: true } }, members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }, orderBy: [{ isSubmitter: 'desc' }, { joinedAt: 'asc' }] }, season: { select: { id: true, name: true } }, importBatch: { select: { id: true, fileName: true, createdAt: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const batchMap = new Map<string, { batch: NonNullable<(typeof teams)[number]['importBatch']>; teams: typeof teams }>()
  const unbatched: typeof teams = []
  for (const team of teams) {
    if (!team.importBatch) { unbatched.push(team); continue }
    const group = batchMap.get(team.importBatch.id) ?? { batch: team.importBatch, teams: [] }
    group.teams.push(team); batchMap.set(team.importBatch.id, group)
  }
  return { groups: Array.from(batchMap.values()), unbatched, teams }
}
