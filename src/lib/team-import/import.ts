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

async function generateDisplayId(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `T-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
    const existing = await tx.team.findUnique({
      where: { displayId: candidate },
      select: { id: true },
    })

    if (!existing) {
      return candidate
    }
  }

  throw new Error('Could not generate a unique team identifier')
}

function getImportErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return 'A unique team field conflicted during import. Please refresh the preview and try again.'
  }

  return error instanceof Error ? error.message : String(error)
}

function buildResultRowFromPreview(
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
    reason: extra?.reason,
    teamId: extra?.teamId,
    displayId: extra?.displayId,
  }
}

/**
 * Provisions student accounts for people who don't have accounts yet.
 * Creates a user record with a 72-hour activation token, then sends an
 * activation email reusing the reset-password flow.
 *
 * Returns the number of accounts successfully created.
 */
async function provisionStudentAccounts(
  people: TeamImportPersonToProvision[]
): Promise<{ provisionedCount: number; userIdByEmail: Map<string, string> }> {
  // Deduplicate by email across all rows
  const uniquePeople = new Map<string, TeamImportPersonToProvision>()
  for (const person of people) {
    if (!uniquePeople.has(person.email)) {
      uniquePeople.set(person.email, person)
    }
  }

  const userIdByEmail = new Map<string, string>()
  let provisionedCount = 0

  for (const person of uniquePeople.values()) {
    // Check again in case a concurrent import already created this account
    const existing = await prisma.user.findUnique({
      where: { email: person.email },
      select: { id: true },
    })

    if (existing) {
      userIdByEmail.set(person.email, existing.id)
      continue
    }

    try {
      const activationToken = crypto.randomBytes(32).toString('hex')
      const activationExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
      // Placeholder hash — user must set a real password via the activation link
      const passwordHash = await hashPassword(crypto.randomBytes(16).toString('hex'))

      const user = await prisma.user.create({
        data: {
          email: person.email,
          firstName: person.firstName,
          lastName: person.lastName,
          role: 'STUDENT',
          universityId: person.universityId,
          passwordHash,
          emailVerified: false,
          resetToken: activationToken,
          resetTokenExpiry: activationExpiry,
        },
        select: { id: true },
      })

      userIdByEmail.set(person.email, user.id)
      provisionedCount += 1

      // Fire-and-forget: don't let email failure block the import
      sendAccountActivationEmail(person.email, person.firstName, activationToken).catch((err) => {
        logger.error('Failed to send activation email during import', {
          email: person.email,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    } catch (error) {
      logger.error('Failed to provision student account during import', {
        email: person.email,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { provisionedCount, userIdByEmail }
}

export async function importValidatedTeams(args: {
  actor: { id: string; email: string; role: string }
  fileName: string
  validation: TeamImportValidationResult
}): Promise<TeamImportConfirmResult> {
  const now = new Date()
  const rows: TeamImportResultRow[] = []

  // Collect all people to provision across all valid rows
  const allPeopleToProvision: TeamImportPersonToProvision[] = args.validation.validRows.flatMap(
    (row) => row.peopleToProvision
  )

  // Provision missing student accounts and get their new IDs
  const { provisionedCount, userIdByEmail } = await provisionStudentAccounts(allPeopleToProvision)

  for (const validRow of args.validation.validRows) {
    try {
      // Resolve submitter user ID — either already existed or was just provisioned
      const resolvedSubmitterUserId =
        validRow.submitterUserId ??
        userIdByEmail.get(validRow.source.submitter.email) ??
        null

      // Merge existing member IDs (from validation) with IDs of newly provisioned members
      const newlyProvisionedIds = validRow.peopleToProvision
        .map((p) => userIdByEmail.get(p.email))
        .filter((id): id is string => id !== undefined)

      const allMemberUserIds = [
        ...validRow.memberUserIds,
        ...newlyProvisionedIds,
      ]

      const createdTeam = await prisma.$transaction(async (tx) => {
        const displayId = await generateDisplayId(tx)
        const team = await tx.team.create({
          data: {
            name: validRow.source.teamName,
            displayId,
            externalTeamId: validRow.source.teamExternalId,
            status: 'ACTIVE',
            approvedAt: now,
            approvedById: args.actor.id,
            supervisorId: validRow.supervisorId,
            universityId: validRow.universityId,
            seasonId: validRow.seasonId,
          },
          select: {
            id: true,
            displayId: true,
          },
        })

        await tx.teamMember.createMany({
          data: allMemberUserIds.map((userId) => ({
            teamId: team.id,
            userId,
            isSubmitter: userId === resolvedSubmitterUserId,
          })),
        })

        return team
      })

      rows.push(
        buildResultRowFromPreview(validRow.preview, 'created', {
          teamId: createdTeam.id,
          displayId: createdTeam.displayId,
        })
      )
    } catch (error) {
      rows.push(
        buildResultRowFromPreview(validRow.preview, 'skipped', {
          reason: getImportErrorMessage(error),
        })
      )
    }
  }

  const skippedPreviewRows = args.validation.rows
    .filter((row) => !row.valid)
    .map<TeamImportResultRow>((row) =>
      buildResultRowFromPreview(row, 'skipped', {
        reason: row.errors.join('; '),
      })
    )

  const createdCount = rows.filter((row) => row.status === 'created').length
  const skippedRows = skippedPreviewRows.concat(rows.filter((row) => row.status === 'skipped'))

  await logAuditAction(
    args.actor.id,
    'TEAM_IMPORT_CONFIRMED',
    'Team',
    'bulk-import',
    {
      seasonId: args.validation.season.id,
      seasonName: args.validation.season.name,
      fileName: args.fileName,
      totalRows: args.validation.summary.totalRows,
      validRows: args.validation.summary.validRows,
      invalidRows: args.validation.summary.invalidRows,
      ignoredEmptyRows: args.validation.summary.ignoredEmptyRows,
      teamsCreated: createdCount,
      skippedRows: skippedRows.length,
      accountsProvisioned: provisionedCount,
    }
  )

  return {
    season: args.validation.season,
    fileName: args.fileName,
    summary: {
      ...args.validation.summary,
      teamsCreated: createdCount,
      skippedRows: skippedRows.length,
      accountsProvisioned: provisionedCount,
    },
    rows: [...rows, ...skippedPreviewRows].sort((left, right) => left.rowNumber - right.rowNumber),
  }
}
