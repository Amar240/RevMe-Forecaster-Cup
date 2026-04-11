import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Prisma, type SeasonArchive } from '@prisma/client'
import { prisma } from '@/server/db'

export const ARCHIVE_FILES = ['participants.csv', 'results.csv'] as const
export type ArchiveFileName = (typeof ARCHIVE_FILES)[number]

type ParticipantsRow = {
  teamId: string
  teamName: string
  teamDisplayId: string
  university: string
  supervisorEmail: string
  memberEmail: string
  memberFirstName: string
  memberLastName: string
  isSubmitter: boolean | ''
  joinedAt: string
}

type ResultsRow = {
  rank: number | ''
  teamId: string
  teamName: string
  teamDisplayId: string
  university: string
  combinedMape: number | null
  occupancyMape: number | null
  adrMape: number | null
  nErrors: number | null
  roundMapes: Record<number, number | null>
}

function getArchiveBucket() {
  const bucket = process.env.ARCHIVE_S3_BUCKET
  if (!bucket) {
    throw new Error('ARCHIVE_S3_BUCKET is required to archive a season')
  }
  return bucket
}

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-2',
  })
}

export function isArchiveFileName(value: string | null | undefined): value is ArchiveFileName {
  return value === 'participants.csv' || value === 'results.csv'
}

export async function getArchiveDownloadUrl(
  archive: Pick<SeasonArchive, 's3Bucket' | 's3Prefix'>,
  fileName: string,
  expiresIn = 900
) {
  if (!isArchiveFileName(fileName)) {
    throw new Error('A valid archive file is required')
  }

  if (!archive.s3Bucket || !archive.s3Prefix) {
    throw new Error('Archive storage information is incomplete')
  }

  const command = new GetObjectCommand({
    Bucket: archive.s3Bucket,
    Key: `${archive.s3Prefix}/${fileName}`,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  })

  return getSignedUrl(getS3Client(), command, { expiresIn })
}

function escapeCsvValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return ''

  const stringValue = String(value)
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

function buildCsv(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>) {
  const lines = [
    headers.map((header) => escapeCsvValue(header)).join(','),
    ...rows.map((row) => row.map((value) => escapeCsvValue(value)).join(',')),
  ]
  return lines.join('\n')
}

function averagePair(left: number | null, right: number | null) {
  if (left === null || right === null) return null
  return (left + right) / 2
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function buildParticipantsCsv(seasonId: string) {
  const teams = await prisma.team.findMany({
    where: { seasonId },
    orderBy: [{ name: 'asc' }, { displayId: 'asc' }],
    include: {
      university: {
        select: { name: true },
      },
      supervisor: {
        select: { email: true },
      },
      members: {
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  })

  const headers = [
    'teamId',
    'teamName',
    'teamDisplayId',
    'university',
    'supervisorEmail',
    'memberEmail',
    'memberFirstName',
    'memberLastName',
    'isSubmitter',
    'joinedAt',
  ]

  const rows: ParticipantsRow[] = []

  for (const team of teams) {
    const base = {
      teamId: team.id,
      teamName: team.name,
      teamDisplayId: team.displayId,
      university: team.university.name,
      supervisorEmail: team.supervisor?.email ?? '',
    }

    if (team.members.length === 0) {
      rows.push({
        ...base,
        memberEmail: '',
        memberFirstName: '',
        memberLastName: '',
        isSubmitter: '',
        joinedAt: '',
      })
      continue
    }

    rows.push(
      ...team.members.map((member) => ({
        ...base,
        memberEmail: member.user.email,
        memberFirstName: member.user.firstName,
        memberLastName: member.user.lastName,
        isSubmitter: member.isSubmitter,
        joinedAt: member.joinedAt.toISOString(),
      }))
    )
  }

  return buildCsv(
    headers,
    rows.map((row) => [
      row.teamId,
      row.teamName,
      row.teamDisplayId,
      row.university,
      row.supervisorEmail,
      row.memberEmail,
      row.memberFirstName,
      row.memberLastName,
      row.isSubmitter,
      row.joinedAt,
    ])
  )
}

async function buildResultsCsv(seasonId: string) {
  const teams = await prisma.team.findMany({
    where: { seasonId },
    orderBy: [{ name: 'asc' }, { displayId: 'asc' }],
    include: {
      university: {
        select: { name: true },
      },
    },
  })

  const seasonAggregates = await prisma.scoreAggregate.findMany({
    where: {
      seasonId,
      scopeType: 'SEASON',
      metric: { in: ['OCCUPANCY', 'ADR'] },
    },
    select: {
      teamId: true,
      metric: true,
      mape: true,
      nErrors: true,
    },
  })

  const roundAggregates = await prisma.scoreAggregate.findMany({
    where: {
      seasonId,
      scopeType: 'ROUND',
      metric: { in: ['OCCUPANCY', 'ADR'] },
      roundId: { not: null },
    },
    select: {
      teamId: true,
      metric: true,
      mape: true,
      round: {
        select: {
          number: true,
        },
      },
    },
  })

  const seasonScores = new Map<
    string,
    { occupancyMape: number | null; adrMape: number | null; nErrors: number }
  >()

  for (const aggregate of seasonAggregates) {
    const existing = seasonScores.get(aggregate.teamId) ?? {
      occupancyMape: null,
      adrMape: null,
      nErrors: 0,
    }

    if (aggregate.metric === 'OCCUPANCY') {
      existing.occupancyMape = aggregate.mape
      existing.nErrors += aggregate.nErrors
    }

    if (aggregate.metric === 'ADR') {
      existing.adrMape = aggregate.mape
      existing.nErrors += aggregate.nErrors
    }

    seasonScores.set(aggregate.teamId, existing)
  }

  const roundScores = new Map<string, Record<number, { occupancyMape: number | null; adrMape: number | null }>>()

  for (const aggregate of roundAggregates) {
    const roundNumber = aggregate.round?.number
    if (!roundNumber || roundNumber < 1 || roundNumber > 7) continue

    const teamRounds = roundScores.get(aggregate.teamId) ?? {}
    const existingRound = teamRounds[roundNumber] ?? {
      occupancyMape: null,
      adrMape: null,
    }

    if (aggregate.metric === 'OCCUPANCY') {
      existingRound.occupancyMape = aggregate.mape
    }

    if (aggregate.metric === 'ADR') {
      existingRound.adrMape = aggregate.mape
    }

    teamRounds[roundNumber] = existingRound
    roundScores.set(aggregate.teamId, teamRounds)
  }

  const results: ResultsRow[] = teams.map((team) => {
    const seasonScore = seasonScores.get(team.id) ?? {
      occupancyMape: null,
      adrMape: null,
      nErrors: 0,
    }
    const teamRounds = roundScores.get(team.id) ?? {}
    const combinedMape = averagePair(seasonScore.occupancyMape, seasonScore.adrMape)

    const roundMapes = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => {
        const roundNumber = index + 1
        const roundScore = teamRounds[roundNumber]
        return [
          roundNumber,
          roundScore ? averagePair(roundScore.occupancyMape, roundScore.adrMape) : null,
        ]
      })
    ) as Record<number, number | null>

    return {
      rank: '',
      teamId: team.id,
      teamName: team.name,
      teamDisplayId: team.displayId,
      university: team.university.name,
      combinedMape,
      occupancyMape: seasonScore.occupancyMape,
      adrMape: seasonScore.adrMape,
      nErrors: combinedMape === null ? null : seasonScore.nErrors,
      roundMapes,
    }
  })

  const sorted = [...results].sort((left, right) => {
    const leftRankable = left.combinedMape !== null
    const rightRankable = right.combinedMape !== null

    if (leftRankable !== rightRankable) {
      return leftRankable ? -1 : 1
    }

    if (!leftRankable && !rightRankable) {
      return left.teamName.localeCompare(right.teamName)
    }

    if (left.combinedMape !== right.combinedMape) {
      return (left.combinedMape ?? Number.POSITIVE_INFINITY) - (right.combinedMape ?? Number.POSITIVE_INFINITY)
    }

    if (left.occupancyMape !== right.occupancyMape) {
      return (left.occupancyMape ?? Number.POSITIVE_INFINITY) - (right.occupancyMape ?? Number.POSITIVE_INFINITY)
    }

    if (left.adrMape !== right.adrMape) {
      return (left.adrMape ?? Number.POSITIVE_INFINITY) - (right.adrMape ?? Number.POSITIVE_INFINITY)
    }

    if (left.nErrors !== right.nErrors) {
      return (right.nErrors ?? Number.NEGATIVE_INFINITY) - (left.nErrors ?? Number.NEGATIVE_INFINITY)
    }

    return left.teamName.localeCompare(right.teamName)
  })

  let currentRank = 0
  const ranked = sorted.map((result) => {
    if (result.combinedMape !== null) {
      currentRank += 1
      return { ...result, rank: currentRank }
    }

    return result
  })

  const headers = [
    'rank',
    'teamId',
    'teamName',
    'teamDisplayId',
    'university',
    'combinedMape',
    'occupancyMape',
    'adrMape',
    'nErrors',
    'round1Mape',
    'round2Mape',
    'round3Mape',
    'round4Mape',
    'round5Mape',
    'round6Mape',
    'round7Mape',
  ]

  return buildCsv(
    headers,
    ranked.map((row) => [
      row.rank,
      row.teamId,
      row.teamName,
      row.teamDisplayId,
      row.university,
      row.combinedMape,
      row.occupancyMape,
      row.adrMape,
      row.nErrors,
      row.roundMapes[1],
      row.roundMapes[2],
      row.roundMapes[3],
      row.roundMapes[4],
      row.roundMapes[5],
      row.roundMapes[6],
      row.roundMapes[7],
    ])
  )
}

async function uploadArchiveFile(
  bucket: string,
  key: string,
  body: string
) {
  const client = getS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'text/csv; charset=utf-8',
    })
  )
}

export async function runArchiveJob(seasonId: string, userId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      status: true,
    },
  })

  if (!season) {
    throw new Error('Season not found')
  }

  if (season.status !== 'COMPLETED') {
    throw new Error('Only completed seasons can be archived')
  }

  const bucket = getArchiveBucket()
  const latestArchive = await prisma.seasonArchive.findFirst({
    where: { seasonId },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    select: { version: true },
  })

  const version = (latestArchive?.version ?? 0) + 1

  const archive = await prisma.seasonArchive.create({
    data: {
      seasonId,
      triggeredById: userId,
      version,
      status: 'RUNNING',
    },
  })

  try {
    const participantsCsv = await buildParticipantsCsv(seasonId)
    const resultsCsv = await buildResultsCsv(seasonId)
    const prefix = `archives/${seasonId}/v${version}`

    await uploadArchiveFile(bucket, `${prefix}/participants.csv`, participantsCsv)
    await uploadArchiveFile(bucket, `${prefix}/results.csv`, resultsCsv)

    const totalSizeBytes =
      Buffer.byteLength(participantsCsv, 'utf8') + Buffer.byteLength(resultsCsv, 'utf8')

    return await prisma.seasonArchive.update({
      where: { id: archive.id },
      data: {
        status: 'COMPLETED',
        s3Bucket: bucket,
        s3Prefix: prefix,
        completedAt: new Date(),
        totalSizeBytes,
        fileManifest: {
          files: [...ARCHIVE_FILES],
          generatedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        errorMessage: null,
      },
    })
  } catch (error) {
    await prisma.seasonArchive.update({
      where: { id: archive.id },
      data: {
        status: 'FAILED',
        errorMessage: getErrorMessage(error),
      },
    })

    throw error
  }
}
