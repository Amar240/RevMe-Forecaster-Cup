import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAuditAction } from '@/lib/audit'
import { sendAccountActivationEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import type {
  TeamImportConfirmResult,
  TeamImportPersonToProvision,
  TeamImportPreviewRow,
  TeamImportResultRow,
  TeamImportValidationResult,
} from './types'
import type { TeamImportOverride } from './types'

async function generateDisplayId(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `T-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
    if (!(await tx.team.findUnique({ where: { displayId: candidate }, select: { id: true } }))) return candidate
  }
  throw new Error('Could not generate a unique team identifier')
}

function buildResultRow(
  preview: TeamImportPreviewRow,
  status: 'created' | 'skipped',
  extra?: Pick<TeamImportResultRow, 'reason' | 'teamId' | 'displayId'>
): TeamImportResultRow {
  return {
    rowNumber: preview.rowNumber,
    teamExternalId: preview.teamExternalId,
    teamName: preview.teamName,
    universityName: preview.universityName,
    submitterEmail: preview.submitterEmail,
    submitter: preview.submitter,
    members: preview.members,
    memberCount: preview.memberCount,
    status,
    warnings: preview.warnings,
    warningCount: preview.warningCount,
    ...extra,
  }
}

type PreparedPerson = TeamImportPersonToProvision & {
  passwordHash: string
  activationToken: string | null
  activationExpiry: Date | null
}

export async function importValidatedTeams(args: {
  actor: { id: string; email: string; role: string }
  batchId: string
  fileName: string
  mode: 'admin' | 'supervisor'
  validation: TeamImportValidationResult
  overrides?: TeamImportOverride[]
}): Promise<TeamImportConfirmResult> {
  const uniquePeople = new Map<string, TeamImportPersonToProvision>()
  for (const person of args.validation.validRows.flatMap((row) => row.peopleToProvision)) {
    if (!uniquePeople.has(person.email)) uniquePeople.set(person.email, person)
  }

  const preparedPeople = new Map<string, PreparedPerson>()
  for (const person of uniquePeople.values()) {
    const activationToken = args.mode === 'admin' ? crypto.randomBytes(32).toString('hex') : null
    preparedPeople.set(person.email, {
      ...person,
      passwordHash: await hashPassword(crypto.randomBytes(24).toString('hex')),
      activationToken,
      activationExpiry: activationToken ? new Date(Date.now() + 72 * 60 * 60 * 1000) : null,
    })
  }

  const now = new Date()
  const transactionResult = await prisma.$transaction(async (tx) => {
    const userIdByEmail = new Map<string, string>()
    const provisionedUserIds = new Set<string>()
    const activationByUserId = new Map<string, { email: string; firstName: string; token: string }>()

    const allEmails = Array.from(new Set(args.validation.validRows.flatMap((row) => [
      row.source.submitter.email,
      ...row.source.members.map((member) => member.email),
    ])))
    const existingUsers = await tx.user.findMany({ where: { email: { in: allEmails } }, select: { id: true, email: true } })
    for (const user of existingUsers) userIdByEmail.set(user.email.toLowerCase(), user.id)

    for (const person of preparedPeople.values()) {
      if (userIdByEmail.has(person.email)) continue
      const user = await tx.user.create({
        data: {
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          role: 'STUDENT',
          universityId: person.universityId,
          passwordHash: person.passwordHash,
          emailVerified: false,
          resetToken: person.activationToken,
          resetTokenExpiry: person.activationExpiry,
        },
        select: { id: true },
      })
      userIdByEmail.set(person.email, user.id)
      provisionedUserIds.add(user.id)
      if (person.activationToken) activationByUserId.set(user.id, { email: person.email, firstName: person.firstName, token: person.activationToken })
    }

    const createdRows: TeamImportResultRow[] = []
    const provisionedByTeam: Record<string, string[]> = {}
    for (const validRow of args.validation.validRows) {
      const displayId = await generateDisplayId(tx)
      const team = await tx.team.upsert({
        where: { seasonId_externalTeamId: { seasonId: validRow.seasonId, externalTeamId: validRow.source.teamExternalId } },
        create: {
          name: validRow.source.teamName,
          displayId,
          externalTeamId: validRow.source.teamExternalId,
          status: args.mode === 'supervisor' ? 'PENDING_APPROVAL' : 'ACTIVE',
          approvedAt: args.mode === 'admin' ? now : null,
          approvedById: args.mode === 'admin' ? args.actor.id : null,
          supervisorId: validRow.supervisorId,
          universityId: validRow.universityId,
          seasonId: validRow.seasonId,
          importBatchId: args.batchId,
        },
        update: { importBatchId: args.batchId },
        select: { id: true, displayId: true },
      })

      const people = [validRow.source.submitter, ...validRow.source.members]
      const memberships = people.map((person, index) => {
        const userId = userIdByEmail.get(person.email)
        if (!userId) throw new Error(`User resolution failed for ${person.email}`)
        return { teamId: team.id, userId, isSubmitter: index === 0 }
      })
      await tx.teamMember.createMany({ data: memberships, skipDuplicates: true })
      provisionedByTeam[team.id] = memberships.filter((membership) => provisionedUserIds.has(membership.userId)).map((membership) => membership.userId)
      createdRows.push(buildResultRow(validRow.preview, 'created', { teamId: team.id, displayId: team.displayId }))
    }

    const skippedRows = args.validation.rows
      .filter((row) => !row.valid)
      .map((row) => buildResultRow(row, 'skipped', { reason: row.errors.join('; ') }))
    const rows = [...createdRows, ...skippedRows].sort((left, right) => left.rowNumber - right.rowNumber)
    const result: TeamImportConfirmResult = {
      season: args.validation.season,
      fileName: args.fileName,
      summary: {
        ...args.validation.summary,
        teamsCreated: createdRows.length,
        skippedRows: skippedRows.length,
        accountsProvisioned: provisionedUserIds.size,
      },
      rows,
    }

    await tx.importBatch.update({
      where: { id: args.batchId },
      data: {
        status: args.mode === 'admin' ? 'COMPLETED' : 'CONFIRMED',
        summaryJson: JSON.parse(JSON.stringify({
          metadata: args.validation.metadata,
          fileWarnings: args.validation.fileWarnings,
          preview: { summary: args.validation.summary, rows: args.validation.rows },
          result,
          provisionedByTeam,
          overrides: args.overrides ?? [],
        })) as Prisma.InputJsonValue,
      },
    })

    return { result, activationByUserId: Array.from(activationByUserId.values()) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

  if (args.mode === 'admin') {
    for (const activation of transactionResult.activationByUserId) {
      void sendAccountActivationEmail(activation.email, activation.firstName, activation.token).catch((error) => {
        logger.error('Failed to send activation email after admin import', { email: activation.email, error })
      })
    }
  }

  await logAuditAction(args.actor.id, 'TEAM_IMPORT_CONFIRMED', 'ImportBatch', args.batchId, {
    seasonId: args.validation.season.id,
    fileName: args.fileName,
    mode: args.mode,
    teamsCreated: transactionResult.result.summary.teamsCreated,
    skippedRows: transactionResult.result.summary.skippedRows,
    accountsProvisioned: transactionResult.result.summary.accountsProvisioned,
  })

  return transactionResult.result
}
