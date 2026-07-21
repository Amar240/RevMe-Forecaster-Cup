import { prisma } from '@/lib/db'
import { ApiError } from '@/server/http'
import {
  getSeasonScopedMembershipFilter,
  getSupervisorTeamCountsForSeason,
} from '@/server/team-membership'
import { normalizeUniversityName, sameUniversity } from '@/server/universities'
import { z } from 'zod'
import type {
  ParsedTeamImportFile,
  TeamImportPersonInput,
  TeamImportPersonSummary,
  TeamImportPersonToProvision,
  TeamImportPreviewRow,
  TeamImportValidationResult,
  ValidatedTeamImportRow,
} from './types'

const MAX_TEAM_MEMBERS = 5
const SUPERVISOR_TEAM_CAP = 10
const emailSchema = z.string().trim().email()

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? ''
}

function normalizePerson(person: TeamImportPersonInput): TeamImportPersonInput {
  return {
    email: normalizeEmail(person.email),
    firstName: person.firstName.trim(),
    lastName: person.lastName.trim(),
    provenance: person.provenance,
    warnings: person.warnings ?? [],
  }
}

function normalizeTeamNameKey(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function formatName(firstName: string | null | undefined, lastName: string | null | undefined) {
  const parts = [firstName, lastName].map((value) => value?.trim() ?? '').filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

function formatDisplayName(name: string | null, email: string) {
  if (name && email) {
    return `${name} (${email})`
  }

  return name || email || 'Missing email'
}

function normalizeNameForCompare(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function getUploadedNameMismatch(person: TeamImportPersonInput, matchedUser: { firstName: string; lastName: string }) {
  const firstNameMismatch =
    Boolean(person.firstName.trim()) &&
    normalizeNameForCompare(person.firstName) !== normalizeNameForCompare(matchedUser.firstName)
  const lastNameMismatch =
    Boolean(person.lastName.trim()) &&
    normalizeNameForCompare(person.lastName) !== normalizeNameForCompare(matchedUser.lastName)

  return firstNameMismatch || lastNameMismatch
}

function buildPersonSummary(
  person: TeamImportPersonInput,
  matchedUser?: { firstName: string; lastName: string; email: string } | null,
  nameMismatch = false,
  willBeCreated = false
): TeamImportPersonSummary {
  const uploadedName = formatName(person.firstName, person.lastName)
  const matchedNameValue = matchedUser ? formatName(matchedUser.firstName, matchedUser.lastName) ?? matchedUser.email : null
  const displayName = formatDisplayName(uploadedName ?? matchedNameValue, person.email)

  return {
    email: person.email,
    firstName: person.firstName,
    lastName: person.lastName,
    displayName,
    uploadedName,
    matchedName: nameMismatch ? matchedNameValue : null,
    nameMismatch,
    willBeCreated,
    provenance: person.provenance ?? 'Unknown location',
  }
}

function parseEmailList(parsedFile: ParsedTeamImportFile) {
  return Array.from(
    new Set(
      parsedFile.rows.flatMap((row) => {
        const emails = [normalizeEmail(row.submitter.email), ...row.members.map((member) => normalizeEmail(member.email))]
        if (row.supervisorEmail) {
          emails.push(normalizeEmail(row.supervisorEmail))
        }
        return emails.filter(Boolean)
      })
    )
  )
}

function buildNameMismatchWarning(args: {
  personType: 'submitter' | 'member'
  person: TeamImportPersonInput
  matchedUser: { firstName: string; lastName: string; email: string }
}) {
  const uploadedName = formatName(args.person.firstName, args.person.lastName) ?? '(blank)'
  const matchedName = formatName(args.matchedUser.firstName, args.matchedUser.lastName) ?? args.matchedUser.email
  const label = args.personType === 'submitter' ? 'Submitter' : 'Member'

  return `${args.person.provenance ?? label}: ${label} name mismatch for ${args.person.email}: uploaded "${uploadedName}", matched system user "${matchedName}".`
}

export async function validateTeamImport(args: {
  seasonId: string
  parsedFile: ParsedTeamImportFile
  mode?: 'admin' | 'supervisor'
  actor?: { id: string; email: string; universityId: string | null }
}): Promise<TeamImportValidationResult> {
  const season = await prisma.season.findUnique({
    where: { id: args.seasonId },
    select: { id: true, name: true, status: true, registrationOpen: true },
  })

  if (!season) {
    throw new ApiError('Selected season could not be found', 404, 'NOT_FOUND')
  }

  if (season.status === 'COMPLETED') {
    throw new ApiError('Completed seasons cannot accept team imports', 422, 'INVALID_INPUT')
  }
  if (args.mode === 'supervisor' && !season.registrationOpen) {
    throw new ApiError('Team registration is not open for this season', 422, 'INVALID_INPUT')
  }
  if (args.mode === 'supervisor' && (!args.actor || !args.actor.universityId)) {
    throw new ApiError('Supervisor must belong to a university', 422, 'INVALID_INPUT')
  }

  const rows = args.parsedFile.rows

  const allUniversities = await prisma.university.findMany({
    select: {
      id: true,
      name: true,
      normalizedName: true,
    },
  })

  const universityByKey = new Map<string, (typeof allUniversities)[number]>()
  for (const university of allUniversities) {
    const keys = [university.normalizedName, university.name]
      .filter(Boolean)
      .map((value) => normalizeUniversityName(value!))

    for (const key of keys) {
      if (!universityByKey.has(key)) {
        universityByKey.set(key, university)
      }
    }
  }

  const importedExternalIds = Array.from(
    new Set(rows.map((row) => row.teamExternalId.trim()).filter(Boolean))
  )
  const importedTeamNames = rows
    .map((row) => row.teamName.trim() || row.teamExternalId.trim())
    .filter(Boolean)

  const existingTeamsByExternalId = importedExternalIds.length
    ? await prisma.team.findMany({
        where: {
          seasonId: season.id,
          externalTeamId: { in: importedExternalIds },
        },
        select: {
          externalTeamId: true,
        },
      })
    : []

  const existingTeamsByName = importedTeamNames.length
    ? await prisma.team.findMany({
        where: {
          seasonId: season.id,
        },
        select: {
          name: true,
        },
      })
    : []

  const existingExternalIdSet = new Set(
    existingTeamsByExternalId.map((team) => team.externalTeamId).filter(Boolean) as string[]
  )
  const existingTeamNameSet = new Set(
    existingTeamsByName.map((team) => normalizeTeamNameKey(team.name)).filter(Boolean)
  )

  const batchExternalIdCounts = new Map<string, number>()
  for (const externalTeamId of importedExternalIds) {
    batchExternalIdCounts.set(
      externalTeamId,
      rows.filter((row) => row.teamExternalId.trim() === externalTeamId).length
    )
  }

  const batchTeamNameCounts = new Map<string, number>()
  for (const teamName of importedTeamNames) {
    const teamNameKey = normalizeTeamNameKey(teamName)
    batchTeamNameCounts.set(teamNameKey, (batchTeamNameCounts.get(teamNameKey) ?? 0) + 1)
  }

  const importedEmails = parseEmailList(args.parsedFile)

  const users = importedEmails.length
    ? await prisma.user.findMany({
        where: { email: { in: importedEmails } },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          universityId: true,
          university: {
            select: {
              id: true,
              name: true,
              normalizedName: true,
            },
          },
        },
      })
    : []

  const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]))

  const supervisors = await prisma.user.findMany({
    where: { role: 'SUPERVISOR' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      universityId: true,
      university: {
        select: {
          id: true,
          name: true,
          normalizedName: true,
        },
      },
    },
  })

  const studentUserIds = users.filter((user) => user.role === 'STUDENT').map((user) => user.id)
  const membershipRows = studentUserIds.length
    ? await prisma.teamMember.findMany({
        where: {
          userId: { in: studentUserIds },
          ...getSeasonScopedMembershipFilter({ seasonId: season.id, excludeTeamStatuses: ['REJECTED', 'ARCHIVED'] }),
        },
        select: {
          userId: true,
          team: {
            select: {
              id: true,
              name: true,
              displayId: true,
            },
          },
        },
      })
    : []

  const existingMembershipsByUserId = new Map<string, (typeof membershipRows)[number]>()
  for (const membership of membershipRows) {
    if (!existingMembershipsByUserId.has(membership.userId)) {
      existingMembershipsByUserId.set(membership.userId, membership)
    }
  }

  const existingSupervisorTeamCounts = await getSupervisorTeamCountsForSeason({
    seasonId: season.id,
    supervisorIds: supervisors.map((supervisor) => supervisor.id),
    db: prisma,
    excludeStatuses: ['REJECTED', 'ARCHIVED'],
  })

  const emailLocations = new Map<string, string[]>()
  for (const row of rows) {
    for (const person of [row.submitter, ...row.members]) {
      const email = normalizeEmail(person.email)
      if (!email) continue
      const locations = emailLocations.get(email) ?? []
      locations.push(person.provenance ?? `Row ${row.rowNumber}`)
      emailLocations.set(email, locations)
    }
  }

  const fileWarnings = [...args.parsedFile.warnings]
  if (args.parsedFile.metadata.instructorEmail && args.actor?.email && normalizeEmail(args.parsedFile.metadata.instructorEmail) !== normalizeEmail(args.actor.email)) {
    fileWarnings.push(`Workbook instructor email ${args.parsedFile.metadata.instructorEmail} differs from uploader ${normalizeEmail(args.actor.email)}.`)
  }

  const acceptedSupervisorBatchCounts = new Map<string, number>()
  const previewRows: TeamImportPreviewRow[] = []
  const validRows: ValidatedTeamImportRow[] = []

  for (const row of rows) {
    const errors: string[] = []
    const warnings: string[] = []
    const normalizedUniversityName = row.universityName.trim()
    const externalTeamId = row.teamExternalId.trim()
    const finalTeamName = row.teamName.trim() || externalTeamId
    const submitter = normalizePerson(row.submitter)
    const members = row.members.map(normalizePerson).filter((member) => Boolean(member.email || member.firstName || member.lastName))
    const submitterEmail = submitter.email
    const allPeople = [submitter, ...members]
    const peopleWithEmail = allPeople.filter((person) => Boolean(person.email))
    const allEmails = peopleWithEmail.map((person) => person.email)
    const memberCount = new Set(allEmails).size
    const teamProvenance = `Row ${row.rowNumber} · Team`
    warnings.push(...allPeople.flatMap((person) => person.warnings ?? []))

    let university: (typeof allUniversities)[number] | null = null
    let resolvedSupervisor: (typeof supervisors)[number] | null = null
    let autoMatchedSupervisor = false

    if (!normalizedUniversityName) {
      errors.push(`${teamProvenance}: University is required`)
    } else {
      university = universityByKey.get(normalizeUniversityName(normalizedUniversityName)) ?? null
      if (!university) {
        errors.push(`${teamProvenance}: University could not be matched to an existing university`)
      }
    }
    if (args.mode === 'supervisor' && university && university.id !== args.actor?.universityId) {
      errors.push(`${teamProvenance}: Institution must match the uploading supervisor's university`)
    }

    if (!externalTeamId) {
      errors.push(`${teamProvenance}: Team identifier is required`)
    } else {
      if ((batchExternalIdCounts.get(externalTeamId) ?? 0) > 1) {
        errors.push(`${teamProvenance}: Team identifier appears more than once in this import file`)
      }
      if (existingExternalIdSet.has(externalTeamId)) {
        errors.push(`${teamProvenance}: Team identifier is already used in the selected season`)
      }
    }

    if (!finalTeamName) {
      errors.push(`${teamProvenance}: Team name is required`)
    } else {
      const teamNameKey = normalizeTeamNameKey(finalTeamName)
      if ((batchTeamNameCounts.get(teamNameKey) ?? 0) > 1) {
        errors.push(`${teamProvenance}: Team name appears more than once in this import file`)
      }
      if (existingTeamNameSet.has(teamNameKey)) {
        errors.push(`${teamProvenance}: A team with this name already exists in this season`)
      }
    }

    if (!submitterEmail) {
      errors.push(`${submitter.provenance}: Submitter email is required`)
    } else if (!emailSchema.safeParse(submitterEmail).success) {
      errors.push(`${submitter.provenance}: Submitter email is not valid`)
    }

    const duplicateEmails = Array.from(
      allEmails.reduce((duplicates, email, index) => {
        if (!email) return duplicates
        if (allEmails.indexOf(email) !== index) {
          duplicates.add(email)
        }
        return duplicates
      }, new Set<string>())
    )

    if (duplicateEmails.length > 0) {
      errors.push(`${teamProvenance}: Duplicate team member email(s): ${duplicateEmails.join(', ')}`)
    }

    for (const person of peopleWithEmail) {
      const locations = emailLocations.get(person.email) ?? []
      if (locations.length > 1) {
        errors.push(`${person.provenance}: ${person.email} also appears at ${locations.filter((location) => location !== person.provenance).join(', ')}`)
      }
    }

    if (memberCount === 0) {
      errors.push(`${teamProvenance}: At least one student email is required`)
    }

    if (memberCount > MAX_TEAM_MEMBERS) {
      errors.push(`${teamProvenance}: Teams can include at most ${MAX_TEAM_MEMBERS} students`)
    }

    const studentEntries = allPeople.map((person, index) => ({
      personType: index === 0 ? ('submitter' as const) : ('member' as const),
      person,
      user: usersByEmail.get(person.email) ?? null,
    }))

    const peopleToProvision: TeamImportPersonToProvision[] = []

    for (const entry of studentEntries) {
      if (!entry.person.email) {
        if (entry.personType === 'member') errors.push(`${entry.person.provenance}: Student email is required`)
        continue
      }
      if (!emailSchema.safeParse(entry.person.email).success) {
        errors.push(`${entry.person.provenance}: Student email is not valid: ${entry.person.email}`)
        continue
      }

      if (!entry.user) {
        // No existing account — will be provisioned during import confirmation
        if (university) {
          peopleToProvision.push({
            email: entry.person.email,
            firstName: entry.person.firstName || entry.person.email.split('@')[0],
            lastName: entry.person.lastName || '',
            universityId: university.id,
          })
        }
        continue
      }

      if (entry.user.role !== 'STUDENT') {
        errors.push(`${entry.person.provenance}: User is not a student: ${entry.person.email}`)
        continue
      }

      if (!entry.user.universityId || !sameUniversity(university, entry.user.university)) {
        errors.push(`${entry.person.provenance}: Student must belong to the same university as the team: ${entry.person.email}`)
      }

      if (getUploadedNameMismatch(entry.person, entry.user)) {
        warnings.push(
          buildNameMismatchWarning({
            personType: entry.personType,
            person: entry.person,
            matchedUser: entry.user,
          })
        )
      }

      const existingMembership = existingMembershipsByUserId.get(entry.user.id)
      if (existingMembership) {
        errors.push(
          `${entry.person.provenance}: Student is already assigned to ${existingMembership.team.name} (${existingMembership.team.displayId}) in the selected season`
        )
      }
    }

    const supervisorEmail = args.mode === 'supervisor' ? normalizeEmail(args.actor?.email) : normalizeEmail(row.supervisorEmail)
    if (args.mode === 'supervisor') {
      resolvedSupervisor = supervisors.find((supervisor) => supervisor.id === args.actor?.id) ?? null
      if (!resolvedSupervisor) errors.push(`${teamProvenance}: Uploading supervisor account could not be resolved`)
    } else if (supervisorEmail) {
      const supervisorUser = usersByEmail.get(supervisorEmail) ?? null
      if (!supervisorUser) {
        errors.push(`${teamProvenance}: Supervisor not found: ${supervisorEmail}`)
      } else if (supervisorUser.role !== 'SUPERVISOR') {
        errors.push(`${teamProvenance}: User is not a supervisor: ${supervisorEmail}`)
      } else if (!supervisorUser.universityId || !sameUniversity(university, supervisorUser.university)) {
        errors.push(`${teamProvenance}: Supervisor must belong to the same university as the team: ${supervisorEmail}`)
      } else {
        resolvedSupervisor = supervisorUser
      }
    } else if (row.format === 'legacy') {
      const matchingSupervisors = university
        ? supervisors.filter((supervisor) => sameUniversity(university, supervisor.university))
        : []

      if (matchingSupervisors.length === 1) {
        resolvedSupervisor = matchingSupervisors[0]
        autoMatchedSupervisor = true
      } else if (matchingSupervisors.length === 0) {
        errors.push(`${teamProvenance}: Legacy row could not be matched to a supervisor for that university`)
      } else {
        errors.push(`${teamProvenance}: Legacy row matches multiple supervisors for that university`)
      }
    } else {
      errors.push(`${teamProvenance}: Supervisor email is required`)
    }

    if (resolvedSupervisor) {
      const existingCount = existingSupervisorTeamCounts.get(resolvedSupervisor.id) ?? 0
      const batchCount = acceptedSupervisorBatchCounts.get(resolvedSupervisor.id) ?? 0
      if (existingCount + batchCount >= SUPERVISOR_TEAM_CAP) {
        errors.push(`${teamProvenance}: Supervisor already manages the maximum of ${SUPERVISOR_TEAM_CAP} teams`)
      }
    }

    const submitterUser = studentEntries.find((entry) => entry.personType === 'submitter')?.user
    const matchedSubmitterUser =
      submitterUser && submitterUser.role === 'STUDENT'
        ? submitterUser
        : null
    const submitterWillBeCreated = !submitterUser && emailSchema.safeParse(submitter.email).success
    const submitterNameMismatch =
      matchedSubmitterUser
        ? getUploadedNameMismatch(submitter, matchedSubmitterUser)
        : false
    const submitterSummary = buildPersonSummary(
      submitter,
      matchedSubmitterUser,
      submitterNameMismatch,
      submitterWillBeCreated
    )

    const memberSummaries = members.map((member) => {
      const matchedUser = usersByEmail.get(member.email) ?? null
      const matchedStudentUser =
        matchedUser && matchedUser.role === 'STUDENT'
          ? matchedUser
          : null
      const memberWillBeCreated = !matchedUser && emailSchema.safeParse(member.email).success
      const nameMismatch =
        matchedStudentUser
          ? getUploadedNameMismatch(member, matchedStudentUser)
          : false

      return buildPersonSummary(
        member,
        matchedStudentUser,
        nameMismatch,
        memberWillBeCreated
      )
    })

    const preview: TeamImportPreviewRow = {
      rowNumber: row.rowNumber,
      format: row.format,
      teamExternalId: externalTeamId,
      teamName: finalTeamName,
      universityName: normalizedUniversityName,
      supervisorEmail: resolvedSupervisor?.email ?? supervisorEmail ?? null,
      supervisorLabel:
        resolvedSupervisor
          ? formatDisplayName(
              formatName(resolvedSupervisor.firstName, resolvedSupervisor.lastName),
              resolvedSupervisor.email
            )
          : null,
      submitterEmail,
      submitter: submitterSummary,
      members: memberSummaries,
      memberCount,
      valid: errors.length === 0,
      autoMatchedSupervisor,
      warnings,
      warningCount: warnings.length,
      errors,
    }

    previewRows.push(preview)

    if (errors.length > 0 || !university || !resolvedSupervisor) {
      continue
    }

    const resolvedMemberIds: string[] = []
    for (const entry of studentEntries) {
      if (entry.user && entry.user.role === 'STUDENT') {
        resolvedMemberIds.push(entry.user.id)
      }
    }

    acceptedSupervisorBatchCounts.set(
      resolvedSupervisor.id,
      (acceptedSupervisorBatchCounts.get(resolvedSupervisor.id) ?? 0) + 1
    )

    validRows.push({
      source: {
        ...row,
        teamExternalId: externalTeamId,
        teamName: finalTeamName,
        supervisorEmail: resolvedSupervisor.email,
        submitter,
        members,
      },
      preview,
      seasonId: season.id,
      universityId: university.id,
      supervisorId: resolvedSupervisor.id,
      submitterUserId: submitterUser?.role === 'STUDENT' ? submitterUser.id : null,
      memberUserIds: resolvedMemberIds,
      peopleToProvision,
    })
  }

  const accountsToProvision = new Set(
    validRows.flatMap((row) => row.peopleToProvision.map((person) => person.email))
  ).size

  return {
    season,
    rows: previewRows,
    validRows,
    summary: {
      totalRows: previewRows.length,
      validRows: validRows.length,
      invalidRows: previewRows.length - validRows.length,
      rowsWithWarnings: previewRows.filter((row) => row.warningCount > 0).length,
      ignoredEmptyRows: args.parsedFile.ignoredEmptyRows,
      fileType: args.parsedFile.fileType,
      detectedFormats: args.parsedFile.detectedFormats,
      accountsToProvision,
      existingAccounts: new Set(validRows.flatMap((row) => [row.submitterUserId, ...row.memberUserIds].filter(Boolean))).size,
    },
    metadata: args.parsedFile.metadata,
    fileWarnings,
  }
}
