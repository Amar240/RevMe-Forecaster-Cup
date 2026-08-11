import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  ResourceNotFoundException,
  SchedulerClient,
} from '@aws-sdk/client-scheduler'

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const DEFAULT_GROUP = 'revme-round-transitions'
const DEFAULT_RETRY_AGE_SECONDS = 3600
const DEFAULT_RETRY_ATTEMPTS = 5

interface SchedulerConfiguration {
  region: string
  groupName: string
  lambdaArn: string
  schedulerRoleArn: string
  deadLetterArn?: string
}

export interface RoundSchedulerConfigurationStatus {
  configured: boolean
  region: string
  groupName: string
  missing: string[]
}

function getConfiguration(): SchedulerConfiguration | null {
  const region = process.env.AWS_REGION ?? 'us-east-2'
  const groupName = process.env.ROUND_AUTOMATION_SCHEDULE_GROUP ?? DEFAULT_GROUP
  const lambdaArn = process.env.ROUND_AUTOMATION_LAMBDA_ARN
  const schedulerRoleArn = process.env.ROUND_AUTOMATION_SCHEDULER_ROLE_ARN
  if (!lambdaArn || !schedulerRoleArn) return null

  return {
    region,
    groupName,
    lambdaArn,
    schedulerRoleArn,
    deadLetterArn: process.env.ROUND_AUTOMATION_DLQ_ARN,
  }
}

export function getRoundSchedulerConfigurationStatus(): RoundSchedulerConfigurationStatus {
  const missing: string[] = []
  if (!process.env.ROUND_AUTOMATION_LAMBDA_ARN) missing.push('ROUND_AUTOMATION_LAMBDA_ARN')
  if (!process.env.ROUND_AUTOMATION_SCHEDULER_ROLE_ARN) {
    missing.push('ROUND_AUTOMATION_SCHEDULER_ROLE_ARN')
  }

  return {
    configured: missing.length === 0,
    region: process.env.AWS_REGION ?? 'us-east-2',
    groupName: process.env.ROUND_AUTOMATION_SCHEDULE_GROUP ?? DEFAULT_GROUP,
    missing,
  }
}

function safeSchedulePart(value: string) {
  return value.replace(/[^0-9A-Za-z_.-]/g, '-').slice(0, 28)
}

function scheduleName(
  seasonId: string,
  generation: number,
  roundNumber: number,
  boundary: 'open' | 'close'
) {
  return `revme-${safeSchedulePart(seasonId)}-g${generation}-r${roundNumber}-${boundary}`.slice(0, 64)
}

function atExpression(date: Date) {
  return `at(${date.toISOString().replace(/\.\d{3}Z$/, '')})`
}

function safeScheduleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/arn:aws:[^\s]+/g, '[aws-resource]').slice(0, 500)
}

async function deleteScheduleIfPresent(
  client: SchedulerClient,
  groupName: string,
  name: string
) {
  try {
    await client.send(new DeleteScheduleCommand({ GroupName: groupName, Name: name }))
  } catch (error) {
    if (error instanceof ResourceNotFoundException) return
    throw error
  }
}

export async function syncSeasonRoundSchedules(seasonId: string) {
  const config = getConfiguration()
  if (!config) {
    const message = `Round scheduler is not configured: ${getRoundSchedulerConfigurationStatus().missing.join(', ')}`
    await prisma.season.update({
      where: { id: seasonId },
      data: { roundAutomationScheduleError: message },
    })
    throw new Error(message)
  }

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { rounds: { orderBy: { number: 'asc' } } },
  })
  if (!season) throw new Error(`Season ${seasonId} was not found`)
  if (season.roundAutomationMode !== 'AUTOMATIC') {
    return { scheduled: 0, skipped: season.rounds.length * 2, generation: season.roundAutomationGeneration }
  }

  const client = new SchedulerClient({ region: config.region })
  const now = new Date()
  let scheduled = 0
  let skipped = 0

  try {
    for (const round of season.rounds) {
      const boundaries = [
        { kind: 'open' as const, at: round.opensAt },
        { kind: 'close' as const, at: new Date(round.closesAt.getTime() + 1_000) },
      ]

      for (const boundary of boundaries) {
        if (boundary.at <= now) {
          skipped += 1
          continue
        }

        const name = scheduleName(
          season.id,
          season.roundAutomationGeneration,
          round.number,
          boundary.kind
        )
        await deleteScheduleIfPresent(client, config.groupName, name)
        const idempotencyKey = [
          'scheduled',
          season.id,
          season.roundAutomationGeneration,
          round.id,
          boundary.kind,
          boundary.at.toISOString(),
        ].join(':')

        await client.send(new CreateScheduleCommand({
          Name: name,
          GroupName: config.groupName,
          Description: `RevME ${season.name} round ${round.number} ${boundary.kind} reconciliation`,
          ScheduleExpression: atExpression(boundary.at),
          ScheduleExpressionTimezone: 'UTC',
          FlexibleTimeWindow: { Mode: 'OFF' },
          ActionAfterCompletion: 'DELETE',
          State: 'ENABLED',
          Target: {
            Arn: config.lambdaArn,
            RoleArn: config.schedulerRoleArn,
            Input: JSON.stringify({
              seasonId: season.id,
              generation: season.roundAutomationGeneration,
              idempotencyKey,
              scheduledFor: boundary.at.toISOString(),
            }),
            RetryPolicy: {
              MaximumEventAgeInSeconds: DEFAULT_RETRY_AGE_SECONDS,
              MaximumRetryAttempts: DEFAULT_RETRY_ATTEMPTS,
            },
            ...(config.deadLetterArn ? { DeadLetterConfig: { Arn: config.deadLetterArn } } : {}),
          },
        }))
        scheduled += 1
      }
    }

    await prisma.season.update({
      where: { id: season.id },
      data: {
        roundAutomationLastSyncedAt: new Date(),
        roundAutomationScheduleError: null,
      },
    })
    logger.info('Round transition schedules synchronized', {
      seasonId: season.id,
      generation: season.roundAutomationGeneration,
      scheduled,
      skipped,
    })
    return { scheduled, skipped, generation: season.roundAutomationGeneration }
  } catch (error) {
    const message = safeScheduleError(error)
    await prisma.season.update({
      where: { id: season.id },
      data: { roundAutomationScheduleError: message },
    })
    logger.error('Failed to synchronize round transition schedules', {
      seasonId: season.id,
      generation: season.roundAutomationGeneration,
      error: message,
    })
    throw error
  } finally {
    client.destroy()
  }
}
