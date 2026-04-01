import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logAuditAction } from '@/lib/audit'
import type {
  TeamImportConfirmResult,
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

export async function importValidatedTeams(args: {
  actor: { id: string; email: string; role: string }
  fileName: string
  validation: TeamImportValidationResult
}): Promise<TeamImportConfirmResult> {
  const now = new Date()
  const rows: TeamImportResultRow[] = []

  for (const validRow of args.validation.validRows) {
    try {
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
          data: validRow.memberUserIds.map((userId) => ({
            teamId: team.id,
            userId,
            isSubmitter: userId === validRow.submitterUserId,
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
    }
  )

  return {
    season: args.validation.season,
    fileName: args.fileName,
    summary: {
      ...args.validation.summary,
      teamsCreated: createdCount,
      skippedRows: skippedRows.length,
      accountsProvisioned: 0,
    },
    rows: [...rows, ...skippedPreviewRows].sort((left, right) => left.rowNumber - right.rowNumber),
  }
}
