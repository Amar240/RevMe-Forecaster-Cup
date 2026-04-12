import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Prisma, type SeasonArchive } from '@prisma/client'
import { prisma } from '@/server/db'

export const ARCHIVE_FILES = ['participants.csv', 'results.csv'] as const
export type ArchiveFileName = (typeof ARCHIVE_FILES)[number]

const TRACKED_ARCHIVE_MARKETS = [
  { name: 'Nashville CBD', key: 'nashville' },
  { name: 'Dubai', key: 'dubai' },
  { name: 'Hamburg', key: 'hamburg' },
] as const

type TrackedArchiveMarketKey = (typeof TRACKED_ARCHIVE_MARKETS)[number]['key']

type ParticipantsRow = {
  seasonName: string
  seasonStatus: string
  seasonStartDate: string
  seasonEndDate: string
  teamId: string
  teamDisplayId: string
  teamExternalId: string
  teamName: string
  teamStatus: string
  disqualifiedReason: string
  warningCount: number
  universityName: string
  universityCountry: string
  supervisorEmail: string
  supervisorFirstName: string
  supervisorLastName: string
  memberEmail: string
  memberFirstName: string
  memberLastName: string
  memberUniversity: string
  memberCountry: string
  isSubmitter: boolean | ''
  joinedAt: string
}

type MetricAggregateSummary = {
  occupancyMape: number | null
  adrMape: number | null
  nErrors: number
}

type ResultsRow = {
  seasonName: string
  rank: number | ''
  teamDisplayId: string
  teamExternalId: string
  teamName: string
  teamStatus: string
  universityName: string
  supervisorEmail: string
  supervisorFirstName: string
  supervisorLastName: string
  submitterEmail: string
  submitterFirstName: string
  submitterLastName: string
  memberCount: number
  submissionCount: number
  totalRounds: number
  warningCount: number
  disqualifiedReason: string
  combinedMape: number | null
  occupancyMape: number | null
  adrMape: number | null
  nErrors: number | null
  marketMapes: Record<TrackedArchiveMarketKey, MetricAggregateSummary>
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

function createMetricAggregateSummary(): MetricAggregateSummary {
  return {
    occupancyMape: null,
    adrMape: null,
    nErrors: 0,
  }
}

function createTrackedMarketMap(): Record<TrackedArchiveMarketKey, MetricAggregateSummary> {
  return {
    nashville: createMetricAggregateSummary(),
    dubai: createMetricAggregateSummary(),
    hamburg: createMetricAggregateSummary(),
  }
}

function applyMetricAggregate(
  summary: MetricAggregateSummary,
  metric: 'OCCUPANCY' | 'ADR',
  mape: number,
  nErrors: number
) {
  if (metric === 'OCCUPANCY') {
    summary.occupancyMape = mape
  } else {
    summary.adrMape = mape
  }

  summary.nErrors += nErrors
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function buildParticipantsCsv(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      name: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  })

  if (!season) {
    throw new Error('Season not found')
  }

  const teams = await prisma.team.findMany({
    where: { seasonId },
    orderBy: [{ name: 'asc' }, { displayId: 'asc' }],
    select: {
      id: true,
      displayId: true,
      externalTeamId: true,
      name: true,
      status: true,
      disqualifiedReason: true,
      _count: {
        select: { warnings: true },
      },
      university: {
        select: { name: true, country: true },
      },
      supervisor: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      members: {
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        select: {
          isSubmitter: true,
          joinedAt: true,
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              university: {
                select: {
                  name: true,
                  country: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const headers = [
    'seasonName',
    'seasonStatus',
    'seasonStartDate',
    'seasonEndDate',
    'teamId',
    'teamDisplayId',
    'teamExternalId',
    'teamName',
    'teamStatus',
    'disqualifiedReason',
    'warningCount',
    'universityName',
    'universityCountry',
    'supervisorEmail',
    'supervisorFirstName',
    'supervisorLastName',
    'memberEmail',
    'memberFirstName',
    'memberLastName',
    'memberUniversity',
    'memberCountry',
    'isSubmitter',
    'joinedAt',
  ]

  const rows: ParticipantsRow[] = []

  for (const team of teams) {
    const base = {
      seasonName: season.name,
      seasonStatus: season.status,
      seasonStartDate: season.startDate.toISOString(),
      seasonEndDate: season.endDate.toISOString(),
      teamId: team.id,
      teamDisplayId: team.displayId,
      teamExternalId: team.externalTeamId ?? '',
      teamName: team.name,
      teamStatus: team.status,
      disqualifiedReason: team.disqualifiedReason ?? '',
      warningCount: team._count.warnings,
      universityName: team.university.name,
      universityCountry: team.university.country ?? '',
      supervisorEmail: team.supervisor?.email ?? '',
      supervisorFirstName: team.supervisor?.firstName ?? '',
      supervisorLastName: team.supervisor?.lastName ?? '',
    }

    if (team.members.length === 0) {
      rows.push({
        ...base,
        memberEmail: '',
        memberFirstName: '',
        memberLastName: '',
        memberUniversity: '',
        memberCountry: '',
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
        memberUniversity: member.user.university?.name ?? '',
        memberCountry: member.user.university?.country ?? '',
        isSubmitter: member.isSubmitter,
        joinedAt: member.joinedAt.toISOString(),
      }))
    )
  }

  return buildCsv(
    headers,
    rows.map((row) => [
      row.seasonName,
      row.seasonStatus,
      row.seasonStartDate,
      row.seasonEndDate,
      row.teamId,
      row.teamDisplayId,
      row.teamExternalId,
      row.teamName,
      row.teamStatus,
      row.disqualifiedReason,
      row.warningCount,
      row.universityName,
      row.universityCountry,
      row.supervisorEmail,
      row.supervisorFirstName,
      row.supervisorLastName,
      row.memberEmail,
      row.memberFirstName,
      row.memberLastName,
      row.memberUniversity,
      row.memberCountry,
      row.isSubmitter,
      row.joinedAt,
    ])
  )
}

async function buildResultsCsv(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      name: true,
      rounds: {
        orderBy: { number: 'asc' },
        select: {
          id: true,
          number: true,
        },
      },
      markets: {
        where: { isActive: true },
        select: {
          market: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!season) {
    throw new Error('Season not found')
  }

  const teams = await prisma.team.findMany({
    where: { seasonId },
    orderBy: [{ name: 'asc' }, { displayId: 'asc' }],
    select: {
      id: true,
      displayId: true,
      externalTeamId: true,
      name: true,
      status: true,
      disqualifiedReason: true,
      _count: {
        select: {
          members: true,
          submissions: true,
          warnings: true,
        },
      },
      university: {
        select: { name: true },
      },
      supervisor: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      members: {
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        select: {
          isSubmitter: true,
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

  const seasonAggregates = await prisma.scoreAggregate.findMany({
    where: {
      seasonId,
      scopeType: 'SEASON',
      metric: { in: ['OCCUPANCY', 'ADR'] },
    },
    select: {
      teamId: true,
      metric: true,
      marketId: true,
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

  const trackedMarketIds = new Map<string, TrackedArchiveMarketKey>()
  for (const trackedMarket of TRACKED_ARCHIVE_MARKETS) {
    const seasonMarket = season.markets.find(({ market }) => market.name === trackedMarket.name)
    if (seasonMarket) {
      trackedMarketIds.set(seasonMarket.market.id, trackedMarket.key)
    }
  }

  const marketScores = new Map<string, Record<TrackedArchiveMarketKey, MetricAggregateSummary>>()

  for (const aggregate of seasonAggregates) {
    if (aggregate.marketId) {
      const marketKey = trackedMarketIds.get(aggregate.marketId)
      if (marketKey) {
        const existingMarketScores = marketScores.get(aggregate.teamId) ?? createTrackedMarketMap()
        applyMetricAggregate(existingMarketScores[marketKey], aggregate.metric, aggregate.mape, aggregate.nErrors)
        marketScores.set(aggregate.teamId, existingMarketScores)
      }
      continue
    }

    const existing = seasonScores.get(aggregate.teamId) ?? createMetricAggregateSummary()
    applyMetricAggregate(existing, aggregate.metric, aggregate.mape, aggregate.nErrors)
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

  const totalRounds = season.rounds.length

  const results: ResultsRow[] = teams.map((team) => {
    const seasonScore = seasonScores.get(team.id) ?? createMetricAggregateSummary()
    const teamRounds = roundScores.get(team.id) ?? {}
    const teamMarketScores = marketScores.get(team.id) ?? createTrackedMarketMap()
    const combinedMape = averagePair(seasonScore.occupancyMape, seasonScore.adrMape)
    const submitter = team.members.find((member) => member.isSubmitter)?.user ?? null

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
      seasonName: season.name,
      rank: '',
      teamDisplayId: team.displayId,
      teamExternalId: team.externalTeamId ?? '',
      teamName: team.name,
      teamStatus: team.status,
      universityName: team.university.name,
      supervisorEmail: team.supervisor?.email ?? '',
      supervisorFirstName: team.supervisor?.firstName ?? '',
      supervisorLastName: team.supervisor?.lastName ?? '',
      submitterEmail: submitter?.email ?? '',
      submitterFirstName: submitter?.firstName ?? '',
      submitterLastName: submitter?.lastName ?? '',
      memberCount: team._count.members,
      submissionCount: team._count.submissions,
      totalRounds,
      warningCount: team._count.warnings,
      disqualifiedReason: team.disqualifiedReason ?? '',
      combinedMape,
      occupancyMape: seasonScore.occupancyMape,
      adrMape: seasonScore.adrMape,
      nErrors: combinedMape === null ? null : seasonScore.nErrors,
      marketMapes: teamMarketScores,
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
    'seasonName',
    'rank',
    'teamDisplayId',
    'teamExternalId',
    'teamName',
    'teamStatus',
    'universityName',
    'supervisorEmail',
    'supervisorFirstName',
    'supervisorLastName',
    'submitterEmail',
    'submitterFirstName',
    'submitterLastName',
    'memberCount',
    'submissionCount',
    'totalRounds',
    'warningCount',
    'disqualifiedReason',
    'combinedMape',
    'occupancyMape',
    'adrMape',
    'nErrors',
    'nashvilleCombinedMape',
    'nashvilleOccupancyMape',
    'nashvilleAdrMape',
    'dubaiCombinedMape',
    'dubaiOccupancyMape',
    'dubaiAdrMape',
    'hamburgCombinedMape',
    'hamburgOccupancyMape',
    'hamburgAdrMape',
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
      row.seasonName,
      row.rank,
      row.teamDisplayId,
      row.teamExternalId,
      row.teamName,
      row.teamStatus,
      row.universityName,
      row.supervisorEmail,
      row.supervisorFirstName,
      row.supervisorLastName,
      row.submitterEmail,
      row.submitterFirstName,
      row.submitterLastName,
      row.memberCount,
      row.submissionCount,
      row.totalRounds,
      row.warningCount,
      row.disqualifiedReason,
      row.combinedMape,
      row.occupancyMape,
      row.adrMape,
      row.nErrors,
      averagePair(row.marketMapes.nashville.occupancyMape, row.marketMapes.nashville.adrMape),
      row.marketMapes.nashville.occupancyMape,
      row.marketMapes.nashville.adrMape,
      averagePair(row.marketMapes.dubai.occupancyMape, row.marketMapes.dubai.adrMape),
      row.marketMapes.dubai.occupancyMape,
      row.marketMapes.dubai.adrMape,
      averagePair(row.marketMapes.hamburg.occupancyMape, row.marketMapes.hamburg.adrMape),
      row.marketMapes.hamburg.occupancyMape,
      row.marketMapes.hamburg.adrMape,
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
