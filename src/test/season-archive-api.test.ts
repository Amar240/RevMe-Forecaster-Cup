import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from './db'
import bcrypt from 'bcryptjs'
import { addDays, subHours } from 'date-fns'
import {
  createActual,
  createMarkets,
  createSeasonWithRounds,
  createSubmission,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'
import { loginAs } from './auth'
import { makeRequest } from './http'
import { runArchiveJob } from '@/lib/archive'
import { GET as getArchiveStatus, POST as postArchive } from '@/app/api/admin/season/[id]/archive/route'
import { GET as getArchiveDownload } from '@/app/api/admin/season/[id]/archive/download/route'
import { POST as postSeasonWipe } from '@/app/api/admin/season/[id]/wipe/route'

const { s3SendMock, getSignedUrlMock } = vi.hoisted(() => ({
  s3SendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}))

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = s3SendMock
  },
  PutObjectCommand: class {
    input: Record<string, unknown>

    constructor(input: Record<string, unknown>) {
      this.input = input
    }
  },
  GetObjectCommand: class {
    input: Record<string, unknown>

    constructor(input: Record<string, unknown>) {
      this.input = input
    }
  },
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: getSignedUrlMock,
}))

type ArchiveScenario = {
  admin: Awaited<ReturnType<typeof createUser>>
  supervisor: Awaited<ReturnType<typeof createUser>>
  student: Awaited<ReturnType<typeof createUser>>
  season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  rounds: Awaited<ReturnType<typeof createSeasonWithRounds>>['rounds']
  teams: [Awaited<ReturnType<typeof createTeam>>, Awaited<ReturnType<typeof createTeam>>]
  markets: Awaited<ReturnType<typeof createMarkets>>
  university: Awaited<ReturnType<typeof createUniversity>>
}

async function seedUserCleanupArtifacts(userId: string, permissionId: string, suffix: string) {
  await prisma.session.create({
    data: {
      userId,
      token: `session-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  })

  await prisma.notification.create({
    data: {
      userId,
      type: 'ARCHIVE_TEST',
      title: `Archive test ${suffix}`,
      message: 'Season wipe verification',
    },
  })

  await prisma.userPermission.create({
    data: {
      userId,
      permissionId,
    },
  })
}

async function createCompletedArchiveScenario(): Promise<ArchiveScenario> {
  const passwordHash = await bcrypt.hash('Password123!', 10)

  return prisma.$transaction(async (tx) => {
    const university = await tx.university.create({
      data: {
        name: 'Archive University',
        normalizedName: 'archive university',
        country: 'USA',
      },
    })

    const startDate = subHours(new Date(), 12)
    const season = await tx.season.create({
      data: {
        name: 'Archive Season',
        status: 'COMPLETED',
        startDate,
        endDate: addDays(startDate, 49),
        registrationOpen: true,
      },
    })

    const rounds: ArchiveScenario['rounds'] = []
    for (let i = 1; i <= 7; i += 1) {
      rounds.push(
        await tx.round.create({
          data: {
            seasonId: season.id,
            number: i,
            opensAt: addDays(startDate, i - 1),
            closesAt: addDays(startDate, i),
            isFinal: i === 7,
            status: 'CLOSED',
          },
        })
      )
    }

    const marketNames = ['Nashville CBD', 'BUR Dubai', 'Hamburg Center'] as const
    const markets = await Promise.all(
      marketNames.map((name) =>
        tx.market.upsert({
          where: { name },
          update: {},
          create: { name },
        })
      )
    )

    await tx.seasonMarket.createMany({
      data: markets.map((market) => ({
        seasonId: season.id,
        marketId: market.id,
        isActive: true,
      })),
    })

    const admin = await tx.user.create({
      data: {
        email: 'admin@archive.test',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        passwordHash,
        universityId: university.id,
        emailVerified: true,
        isActive: true,
      },
    })

    const supervisor = await tx.user.create({
      data: {
        email: 'supervisor@archive.test',
        firstName: 'Supervisor',
        lastName: 'User',
        role: 'SUPERVISOR',
        passwordHash,
        universityId: university.id,
        emailVerified: true,
        isActive: true,
      },
    })

    const student = await tx.user.create({
      data: {
        email: 'student@archive.test',
        firstName: 'Ava',
        lastName: 'Analyst',
        role: 'STUDENT',
        passwordHash,
        universityId: university.id,
        emailVerified: true,
        isActive: true,
      },
    })

    const primaryTeam = await tx.team.create({
      data: {
        name: 'Alpha Team',
        displayId: 'T-ARCH-1',
        externalTeamId: 'EXT-ARCH-1',
        supervisorId: supervisor.id,
        universityId: university.id,
        seasonId: season.id,
        status: 'ACTIVE',
      },
    })

    const secondaryTeam = await tx.team.create({
      data: {
        name: 'Beta Team',
        displayId: 'T-ARCH-2',
        externalTeamId: 'EXT-ARCH-2',
        supervisorId: supervisor.id,
        universityId: university.id,
        seasonId: season.id,
        status: 'DISQUALIFIED',
        disqualifiedReason: 'Missed final deadline',
      },
    })

    await tx.teamMember.create({
      data: {
        teamId: primaryTeam.id,
        userId: student.id,
        isSubmitter: true,
      },
    })

    await tx.scoreAggregate.createMany({
      data: [
        {
          seasonId: season.id,
          teamId: primaryTeam.id,
          metric: 'OCCUPANCY',
          scopeType: 'SEASON',
          mape: 0.12,
          nErrors: 8,
        },
        {
          seasonId: season.id,
          teamId: primaryTeam.id,
          metric: 'ADR',
          scopeType: 'SEASON',
          mape: 0.18,
          nErrors: 6,
        },
        {
          seasonId: season.id,
          teamId: secondaryTeam.id,
          metric: 'OCCUPANCY',
          scopeType: 'SEASON',
          mape: 0.09,
          nErrors: 10,
        },
        {
          seasonId: season.id,
          teamId: secondaryTeam.id,
          metric: 'ADR',
          scopeType: 'SEASON',
          mape: 0.13,
          nErrors: 9,
        },
        {
          seasonId: season.id,
          teamId: primaryTeam.id,
          metric: 'OCCUPANCY',
          scopeType: 'ROUND',
          roundId: rounds[0].id,
          mape: 0.14,
          nErrors: 4,
        },
        {
          seasonId: season.id,
          teamId: primaryTeam.id,
          metric: 'ADR',
          scopeType: 'ROUND',
          roundId: rounds[0].id,
          mape: 0.16,
          nErrors: 4,
        },
        {
          seasonId: season.id,
          teamId: secondaryTeam.id,
          metric: 'OCCUPANCY',
          scopeType: 'ROUND',
          roundId: rounds[0].id,
          mape: 0.08,
          nErrors: 5,
        },
        {
          seasonId: season.id,
          teamId: secondaryTeam.id,
          metric: 'ADR',
          scopeType: 'ROUND',
          roundId: rounds[0].id,
          mape: 0.12,
          nErrors: 5,
        },
      ],
    })

    return {
      admin,
      supervisor,
      student,
      season,
      rounds,
      teams: [primaryTeam, secondaryTeam] as const,
      markets,
      university,
    }
  })
}

function getUploadedCommand(keySuffix: string) {
  const call = s3SendMock.mock.calls.find((call) =>
    (((call[0] as { input: Record<string, unknown> }).input.Key) as string).endsWith(keySuffix)
  )

  return call?.[0] as { input: Record<string, unknown> } | undefined
}

function parseCsv(csv: string) {
  const [headerLine, ...dataLines] = csv.trim().split('\n')
  const headers = headerLine.split(',')

  return dataLines.map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])) as Record<string, string>
  })
}

describe('Season archive and wipe APIs', () => {
  beforeEach(() => {
    vi.stubEnv('ARCHIVE_S3_BUCKET', 'revme-archive-bucket')
    vi.stubEnv('AWS_REGION', 'us-east-2')
    s3SendMock.mockReset()
    s3SendMock.mockResolvedValue({})
    getSignedUrlMock.mockReset()
    getSignedUrlMock.mockResolvedValue('https://signed.example.com/download')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('runArchiveJob uploads participants and results CSVs and stores archive metadata', async () => {
    const scenario = await createCompletedArchiveScenario()

    const archive = await runArchiveJob(scenario.season.id, scenario.admin.id)

    expect(archive.status).toBe('COMPLETED')
    expect(archive.version).toBe(1)
    expect(archive.s3Bucket).toBe('revme-archive-bucket')
    expect(archive.s3Prefix).toBe(`archives/${scenario.season.id}/v1`)
    expect(archive.totalSizeBytes).toBeGreaterThan(0)
    expect(s3SendMock).toHaveBeenCalledTimes(2)

    const participantsUpload = getUploadedCommand('participants.csv')
    const resultsUpload = getUploadedCommand('results.csv')

    expect(participantsUpload?.input.Bucket).toBe('revme-archive-bucket')
    expect(participantsUpload?.input.Key).toBe(`archives/${scenario.season.id}/v1/participants.csv`)
    expect(resultsUpload?.input.Key).toBe(`archives/${scenario.season.id}/v1/results.csv`)

    const participantsCsv = participantsUpload?.input.Body as string
    const resultsCsv = resultsUpload?.input.Body as string

    expect(participantsCsv.split('\n')[0]).toBe(
      'seasonName,seasonStatus,seasonStartDate,seasonEndDate,teamId,teamDisplayId,teamExternalId,teamName,teamStatus,disqualifiedReason,warningCount,universityName,universityCountry,supervisorEmail,supervisorFirstName,supervisorLastName,supervisorAssignmentHistory,memberEmail,memberFirstName,memberLastName,memberUniversity,memberCountry,isSubmitter,joinedAt'
    )
    const participantRows = parseCsv(participantsCsv)
    const alphaParticipant = participantRows.find((row) => row.teamDisplayId === 'T-ARCH-1')
    const betaParticipant = participantRows.find((row) => row.teamDisplayId === 'T-ARCH-2')

    expect(alphaParticipant).toMatchObject({
      seasonName: 'Archive Season',
      seasonStatus: 'COMPLETED',
      teamExternalId: 'EXT-ARCH-1',
      teamName: 'Alpha Team',
      teamStatus: 'ACTIVE',
      disqualifiedReason: '',
      warningCount: '0',
      universityName: 'Archive University',
      universityCountry: 'USA',
      supervisorEmail: 'supervisor@archive.test',
      supervisorFirstName: 'Supervisor',
      supervisorLastName: 'User',
      memberEmail: 'student@archive.test',
      memberFirstName: 'Ava',
      memberLastName: 'Analyst',
      memberUniversity: 'Archive University',
      memberCountry: 'USA',
      isSubmitter: 'true',
    })
    expect(alphaParticipant?.seasonStartDate).toBe(scenario.season.startDate.toISOString())
    expect(alphaParticipant?.seasonEndDate).toBe(scenario.season.endDate.toISOString())

    expect(betaParticipant).toMatchObject({
      seasonName: 'Archive Season',
      teamExternalId: 'EXT-ARCH-2',
      teamName: 'Beta Team',
      teamStatus: 'DISQUALIFIED',
      disqualifiedReason: 'Missed final deadline',
      memberEmail: '',
      memberFirstName: '',
      memberLastName: '',
      memberUniversity: '',
      memberCountry: '',
      isSubmitter: '',
      joinedAt: '',
    })

    expect(resultsCsv.split('\n')[0]).toBe(
      'seasonName,rank,teamDisplayId,teamExternalId,teamName,teamStatus,universityName,supervisorEmail,supervisorFirstName,supervisorLastName,supervisorAssignmentHistory,submitterEmail,submitterFirstName,submitterLastName,memberCount,submissionCount,totalRounds,warningCount,disqualifiedReason,combinedMape,occupancyMape,adrMape,nErrors,nashvilleCombinedMape,nashvilleOccupancyMape,nashvilleAdrMape,dubaiCombinedMape,dubaiOccupancyMape,dubaiAdrMape,hamburgCombinedMape,hamburgOccupancyMape,hamburgAdrMape,round1Mape,round2Mape,round3Mape,round4Mape,round5Mape,round6Mape,round7Mape'
    )
    const resultRows = parseCsv(resultsCsv)
    const betaResult = resultRows.find((row) => row.teamDisplayId === 'T-ARCH-2')
    const alphaResult = resultRows.find((row) => row.teamDisplayId === 'T-ARCH-1')

    expect(betaResult).toMatchObject({
      seasonName: 'Archive Season',
      rank: '1',
      teamExternalId: 'EXT-ARCH-2',
      teamName: 'Beta Team',
      teamStatus: 'DISQUALIFIED',
      universityName: 'Archive University',
      supervisorEmail: 'supervisor@archive.test',
      supervisorFirstName: 'Supervisor',
      supervisorLastName: 'User',
      submitterEmail: '',
      submitterFirstName: '',
      submitterLastName: '',
      memberCount: '0',
      submissionCount: '0',
      totalRounds: '7',
      warningCount: '0',
      disqualifiedReason: 'Missed final deadline',
      nashvilleCombinedMape: '',
      nashvilleOccupancyMape: '',
      nashvilleAdrMape: '',
      dubaiCombinedMape: '',
      dubaiOccupancyMape: '',
      dubaiAdrMape: '',
      hamburgCombinedMape: '',
      hamburgOccupancyMape: '',
      hamburgAdrMape: '',
      round2Mape: '',
      round3Mape: '',
      round4Mape: '',
      round5Mape: '',
      round6Mape: '',
      round7Mape: '',
    })
    expect(parseFloat(betaResult?.combinedMape ?? '')).toBeCloseTo(0.11, 5)
    expect(parseFloat(betaResult?.occupancyMape ?? '')).toBeCloseTo(0.09, 5)
    expect(parseFloat(betaResult?.adrMape ?? '')).toBeCloseTo(0.13, 5)
    expect(parseFloat(betaResult?.round1Mape ?? '')).toBeCloseTo(0.1, 5)

    expect(alphaResult).toMatchObject({
      seasonName: 'Archive Season',
      rank: '2',
      teamExternalId: 'EXT-ARCH-1',
      teamName: 'Alpha Team',
      teamStatus: 'ACTIVE',
      submitterEmail: 'student@archive.test',
      submitterFirstName: 'Ava',
      submitterLastName: 'Analyst',
      memberCount: '1',
      submissionCount: '0',
      totalRounds: '7',
      warningCount: '0',
      disqualifiedReason: '',
    })
    expect(parseFloat(alphaResult?.combinedMape ?? '')).toBeCloseTo(0.15, 5)
    expect(parseFloat(alphaResult?.round1Mape ?? '')).toBeCloseTo(0.15, 5)
  })

  it('runArchiveJob marks the archive as failed when S3 upload errors', async () => {
    const scenario = await createCompletedArchiveScenario()
    s3SendMock.mockRejectedValueOnce(new Error('S3 unavailable'))

    await expect(runArchiveJob(scenario.season.id, scenario.admin.id)).rejects.toThrow('S3 unavailable')

    const archive = await prisma.seasonArchive.findFirst({
      where: { seasonId: scenario.season.id },
    })

    expect(archive?.status).toBe('FAILED')
    expect(archive?.errorMessage).toContain('S3 unavailable')
  })

  it('archive route rejects seasons that are not completed', async () => {
    const university = await createUniversity('Draft Archive University')
    const { season } = await createSeasonWithRounds({ name: 'Draft Archive Season', status: 'ACTIVE' })
    const admin = await createUser({
      email: 'admin@draft-archive.test',
      role: 'ADMIN',
      universityId: university.id,
    })

    await loginAs(admin.id)
    const req = makeRequest(`http://localhost/api/admin/season/${season.id}/archive`, {
      method: 'POST',
    })
    const res = await postArchive(req, { params: Promise.resolve({ id: season.id }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.message).toContain('Only completed seasons can be archived')
  })

  it('archive route rejects while an archive is already running', async () => {
    const scenario = await createCompletedArchiveScenario()
    await prisma.seasonArchive.create({
      data: {
        seasonId: scenario.season.id,
        triggeredById: scenario.admin.id,
        version: 1,
        status: 'RUNNING',
      },
    })

    await loginAs(scenario.admin.id)
    const req = makeRequest(`http://localhost/api/admin/season/${scenario.season.id}/archive`, {
      method: 'POST',
    })
    const res = await postArchive(req, { params: Promise.resolve({ id: scenario.season.id }) })
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.message).toContain('already running')
  })

  it('download route returns a signed URL for the latest completed archive', async () => {
    const scenario = await createCompletedArchiveScenario()
    await prisma.seasonArchive.create({
      data: {
        seasonId: scenario.season.id,
        triggeredById: scenario.admin.id,
        version: 2,
        status: 'COMPLETED',
        s3Bucket: 'revme-archive-bucket',
        s3Prefix: `archives/${scenario.season.id}/v2`,
        fileManifest: {
          files: ['participants.csv', 'results.csv'],
          generatedAt: new Date().toISOString(),
        },
        totalSizeBytes: 1234,
        completedAt: new Date(),
      },
    })

    await loginAs(scenario.admin.id)
    const req = makeRequest(`http://localhost/api/admin/season/${scenario.season.id}/archive/download?file=results.csv`)
    const res = await getArchiveDownload(req, { params: Promise.resolve({ id: scenario.season.id }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.url).toBe('https://signed.example.com/download')
    expect(data.fileName).toBe('results.csv')
    expect(data.expiresIn).toBe(900)
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1)

    const [, command] = getSignedUrlMock.mock.calls[0]
    expect((command as { input: Record<string, unknown> }).input.Key).toBe(`archives/${scenario.season.id}/v2/results.csv`)
  })

  it('wipe route rejects when no completed archive exists', async () => {
    const scenario = await createCompletedArchiveScenario()

    await loginAs(scenario.admin.id)
    const req = makeRequest(`http://localhost/api/admin/season/${scenario.season.id}/wipe`, {
      method: 'POST',
      body: { confirmSeasonName: scenario.season.name },
    })
    const res = await postSeasonWipe(req, { params: Promise.resolve({ id: scenario.season.id }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.message).toBe('Season must be archived before wiping')
  })

  it('wipe route rejects when the season name confirmation does not match', async () => {
    const scenario = await createCompletedArchiveScenario()
    await prisma.seasonArchive.create({
      data: {
        seasonId: scenario.season.id,
        triggeredById: scenario.admin.id,
        version: 1,
        status: 'COMPLETED',
        s3Bucket: 'revme-archive-bucket',
        s3Prefix: `archives/${scenario.season.id}/v1`,
        completedAt: new Date(),
      },
    })

    await loginAs(scenario.admin.id)
    const req = makeRequest(`http://localhost/api/admin/season/${scenario.season.id}/wipe`, {
      method: 'POST',
      body: { confirmSeasonName: 'Wrong Name' },
    })
    const res = await postSeasonWipe(req, { params: Promise.resolve({ id: scenario.season.id }) })
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.message).toBe('Season name confirmation does not match')
  })

  it('wipe route rejects when archive files are not technically downloadable', async () => {
    const scenario = await createCompletedArchiveScenario()
    await prisma.seasonArchive.create({
      data: {
        seasonId: scenario.season.id,
        triggeredById: scenario.admin.id,
        version: 1,
        status: 'COMPLETED',
        s3Bucket: 'revme-archive-bucket',
        s3Prefix: `archives/${scenario.season.id}/v1`,
        completedAt: new Date(),
      },
    })

    getSignedUrlMock.mockResolvedValueOnce('https://signed.example.com/participants')
    getSignedUrlMock.mockRejectedValueOnce(new Error('results file missing'))

    await loginAs(scenario.admin.id)
    const req = makeRequest(`http://localhost/api/admin/season/${scenario.season.id}/wipe`, {
      method: 'POST',
      body: { confirmSeasonName: scenario.season.name },
    })
    const res = await postSeasonWipe(req, { params: Promise.resolve({ id: scenario.season.id }) })
    const data = await res.json()

    expect(res.status).toBe(409)
    expect(data.message).toContain('Archive files must be downloadable before wiping')
    expect(await prisma.team.count({ where: { seasonId: scenario.season.id } })).toBe(2)
  })

  it('wipe route deletes season-bound operational data, removes orphaned season-linked users, and preserves cross-season survivors', async () => {
    const scenario = await createCompletedArchiveScenario()
    const [team] = scenario.teams
    const [market] = scenario.markets
    const round = scenario.rounds[0]

    const otherUniversity = await createUniversity('Unrelated Archive University')
    const otherSeason = (await createSeasonWithRounds({ name: 'Other Season' })).season
    await createMarkets(otherSeason.id)
    const otherTeam = await createTeam({
      name: 'Other Team',
      supervisorId: scenario.supervisor.id,
      universityId: otherUniversity.id,
      seasonId: otherSeason.id,
      status: 'ACTIVE',
    })
    const unrelatedStudent = await createUser({
      email: 'unrelated-student@archive.test',
      role: 'STUDENT',
      universityId: otherUniversity.id,
    })
    const seasonOnlySupervisor = await createUser({
      email: 'season-only-supervisor@archive.test',
      role: 'SUPERVISOR',
      universityId: scenario.university.id,
    })
    const permission = await prisma.permission.create({
      data: {
        name: `archive:manage:${Date.now()}`,
        description: 'Archive wipe test permission',
      },
    })

    await seedUserCleanupArtifacts(scenario.student.id, permission.id, 'student')
    await seedUserCleanupArtifacts(scenario.supervisor.id, permission.id, 'preserved-supervisor')
    await seedUserCleanupArtifacts(seasonOnlySupervisor.id, permission.id, 'deleted-supervisor')
    await seedUserCleanupArtifacts(unrelatedStudent.id, permission.id, 'unrelated-student')

    const submission = await createSubmission({
      teamId: team.id,
      roundId: round.id,
      submittedById: scenario.student.id,
      values: [
        { marketId: market.id, metric: 'OCCUPANCY', weekOffset: 1, value: 75 },
        { marketId: market.id, metric: 'ADR', weekOffset: 1, value: 140 },
      ],
    })

    await createActual({
      seasonId: scenario.season.id,
      roundId: round.id,
      marketId: market.id,
      metric: 'OCCUPANCY',
      weekOffset: 1,
      value: 73,
      createdById: scenario.admin.id,
    })

    const scoringRun = await prisma.scoringRun.create({
      data: {
        seasonId: scenario.season.id,
        scope: 'season',
        triggeredByAdminId: scenario.admin.id,
        status: 'SUCCESS',
        finishedAt: new Date(),
      },
    })

    await prisma.predictionError.create({
      data: {
        seasonId: scenario.season.id,
        teamId: team.id,
        roundId: round.id,
        marketId: market.id,
        metric: 'OCCUPANCY',
        weekOffset: 1,
        predictedValue: 75,
        actualValue: 73,
        absError: 2,
        apeError: 0.027,
        scoringRunId: scoringRun.id,
      },
    })

    await prisma.warning.create({
      data: {
        teamId: team.id,
        roundId: round.id,
        type: 'MISSED_SUBMISSION',
      },
    })

    await prisma.joinRequest.create({
      data: {
        seasonId: scenario.season.id,
        teamId: team.id,
        studentId: scenario.student.id,
        supervisorId: scenario.supervisor.id,
        status: 'PENDING',
      },
    })

    const ticket = await prisma.supportTicket.create({
      data: {
        seasonId: scenario.season.id,
        teamId: team.id,
        createdById: scenario.student.id,
        supervisorId: scenario.supervisor.id,
        assignedToId: seasonOnlySupervisor.id,
        subject: 'Help',
        message: 'Need assistance',
      },
    })

    await prisma.supportTicketReply.create({
      data: {
        ticketId: ticket.id,
        authorId: seasonOnlySupervisor.id,
        message: 'I am reviewing this',
      },
    })

    await prisma.cannedResponse.create({
      data: {
        title: 'Season-only escalation',
        content: 'Use the standard escalation response.',
        category: 'GENERAL',
        createdById: seasonOnlySupervisor.id,
      },
    })

    await prisma.marketInfo.create({
      data: {
        seasonId: scenario.season.id,
        marketId: market.id,
        title: 'Market snapshot',
        summary: 'Stable market',
        demandDrivers: [],
        supplyNotes: [],
        risks: [],
        strategyHints: [],
        createdById: scenario.admin.id,
        updatedById: scenario.admin.id,
        resourceLinks: {
          create: {
            label: 'Reference',
            url: 'https://example.com/report',
            type: 'REPORT',
          },
        },
      },
    })

    await prisma.marketRoundUpdate.create({
      data: {
        seasonId: scenario.season.id,
        marketId: market.id,
        roundNumber: round.number,
        headline: 'Round update',
        whatChanged: 'Demand strengthened',
        createdById: scenario.admin.id,
      },
    })

    await prisma.emailDispatch.createMany({
      data: [
        {
          type: 'ROUND_REMINDER',
          recipientId: scenario.student.id,
          roundId: round.id,
          teamId: team.id,
        },
        {
          type: 'ROUND_RESULTS',
          recipientId: scenario.supervisor.id,
          roundId: round.id,
        },
      ],
    })

    await prisma.seasonArchive.create({
      data: {
        seasonId: scenario.season.id,
        triggeredById: scenario.admin.id,
        version: 1,
        status: 'COMPLETED',
        s3Bucket: 'revme-archive-bucket',
        s3Prefix: `archives/${scenario.season.id}/v1`,
        completedAt: new Date(),
      },
    })

    await loginAs(scenario.admin.id)
    const req = makeRequest(`http://localhost/api/admin/season/${scenario.season.id}/wipe`, {
      method: 'POST',
      body: { confirmSeasonName: scenario.season.name },
    })
    const res = await postSeasonWipe(req, { params: Promise.resolve({ id: scenario.season.id }) })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.deletedCounts.supportTicketReplies).toBe(1)
    expect(data.deletedCounts.supportTickets).toBe(1)
    expect(data.deletedCounts.joinRequests).toBe(1)
    expect(data.deletedCounts.warnings).toBe(1)
    expect(data.deletedCounts.submissions).toBe(1)
    expect(data.deletedCounts.submissionValues).toBe(2)
    expect(data.deletedCounts.actuals).toBe(1)
    expect(data.deletedCounts.marketInfos).toBe(1)
    expect(data.deletedCounts.marketRoundUpdates).toBe(1)
    expect(data.deletedCounts.teams).toBe(2)
    expect(data.deletedCounts.teamMembers).toBe(1)
    expect(data.deletedCounts.emailDispatches).toBe(2)
    expect(data.deletedCounts.candidateUsers).toBe(3)
    expect(data.deletedCounts.preservedUsers).toBe(1)
    expect(data.deletedCounts.users).toBe(2)
    expect(data.deletedCounts.candidateUsers).toBe(data.deletedCounts.preservedUsers + data.deletedCounts.users)
    expect(data.deletedCounts.cannedResponses).toBe(1)
    expect(data.deletedCounts.sessions).toBe(2)
    expect(data.deletedCounts.notifications).toBe(2)
    expect(data.deletedCounts.userPermissions).toBe(2)

    expect(await prisma.team.count({ where: { seasonId: scenario.season.id } })).toBe(0)
    expect(await prisma.team.count({ where: { seasonId: otherSeason.id } })).toBe(1)
    expect(await prisma.team.findUnique({ where: { id: otherTeam.id } })).not.toBeNull()
    expect(await prisma.submission.findUnique({ where: { id: submission.id } })).toBeNull()
    expect(await prisma.supportTicket.findUnique({ where: { id: ticket.id } })).toBeNull()
    expect(await prisma.season.findUnique({ where: { id: scenario.season.id } })).not.toBeNull()
    expect(await prisma.round.count({ where: { seasonId: scenario.season.id } })).toBe(7)
    expect(await prisma.seasonMarket.count({ where: { seasonId: scenario.season.id } })).toBe(3)
    expect(await prisma.seasonArchive.count({ where: { seasonId: scenario.season.id } })).toBe(1)
    expect(await prisma.user.findUnique({ where: { id: scenario.student.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: seasonOnlySupervisor.id } })).toBeNull()
    expect(await prisma.user.findUnique({ where: { id: scenario.supervisor.id } })).not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: unrelatedStudent.id } })).not.toBeNull()
    expect(await prisma.user.findUnique({ where: { id: scenario.admin.id } })).not.toBeNull()

    expect(await prisma.session.count({ where: { userId: scenario.student.id } })).toBe(0)
    expect(await prisma.session.count({ where: { userId: seasonOnlySupervisor.id } })).toBe(0)
    expect(await prisma.session.count({ where: { userId: scenario.supervisor.id } })).toBe(1)
    expect(await prisma.session.count({ where: { userId: unrelatedStudent.id } })).toBe(1)

    expect(await prisma.notification.count({ where: { userId: scenario.student.id } })).toBe(0)
    expect(await prisma.notification.count({ where: { userId: seasonOnlySupervisor.id } })).toBe(0)
    expect(await prisma.notification.count({ where: { userId: scenario.supervisor.id } })).toBe(1)
    expect(await prisma.notification.count({ where: { userId: unrelatedStudent.id } })).toBe(1)

    expect(await prisma.userPermission.count({ where: { userId: scenario.student.id } })).toBe(0)
    expect(await prisma.userPermission.count({ where: { userId: seasonOnlySupervisor.id } })).toBe(0)
    expect(await prisma.userPermission.count({ where: { userId: scenario.supervisor.id } })).toBe(1)
    expect(await prisma.userPermission.count({ where: { userId: unrelatedStudent.id } })).toBe(1)
    expect(await prisma.cannedResponse.count({ where: { createdById: seasonOnlySupervisor.id } })).toBe(0)

    const latestAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'SEASON_WIPED',
        entityId: scenario.season.id,
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(latestAudit).not.toBeNull()

    const statusReq = makeRequest(`http://localhost/api/admin/season/${scenario.season.id}/archive`)
    const statusRes = await getArchiveStatus(statusReq, {
      params: Promise.resolve({ id: scenario.season.id }),
    })
    const statusData = await statusRes.json()

    expect(statusRes.status).toBe(200)
    expect(statusData.archive?.status).toBe('COMPLETED')
  })
})
