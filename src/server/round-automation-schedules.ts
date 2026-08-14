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

export type RoundAutomationScheduleEventType =
  | 'ROUND_BOUNDARY'
  | 'EMERGENCY_OVERRIDE_DUE'
  | 'EMERGENCY_OVERRIDE_ESCALATION'

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

export function safeScheduleError(error: unknown) {
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

export async function syncSeasonRoundSchedules(
  seasonId: string,
  options?: { generationOverride?: number; forceAutomatic?: boolean }
) {
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
  if (!options?.forceAutomatic && season.roundAutomationMode !== 'AUTOMATIC') {
    return {
      scheduled: 0,
      skipped: season.rounds.length * 2,
      generation: season.roundAutomationGeneration,
    }
  }

  const client = new SchedulerClient({ region: config.region })
  const now = new Date()
  let scheduled = 0
  let skipped = 0
  const generation = options?.generationOverride ?? season.roundAutomationGeneration

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
          generation,
          round.number,
          boundary.kind
        )
        await deleteScheduleIfPresent(client, config.groupName, name)
        const idempotencyKey = [
          'scheduled',
          season.id,
          generation,
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
              eventType: 'ROUND_BOUNDARY' satisfies RoundAutomationScheduleEventType,
              seasonId: season.id,
              generation,
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
      generation,
      scheduled,
      skipped,
    })
    return { scheduled, skipped, generation }
  } catch (error) {
    const message = safeScheduleError(error)
    await prisma.season.update({
      where: { id: season.id },
      data: { roundAutomationScheduleError: message },
    })
    logger.error('Failed to synchronize round transition schedules', {
      seasonId: season.id,
      generation,
      error: message,
    })
    throw error
  } finally {
    client.destroy()
  }
}

function overrideScheduleName(
  seasonId: string,
  overrideId: string,
  kind: 'due' | 'escalation'
) {
  return `revme-${safeSchedulePart(seasonId)}-ov-${safeSchedulePart(overrideId)}-${kind}`.slice(0, 64)
}

async function createOneTimeSchedule(input: {
  client: SchedulerClient
  config: SchedulerConfiguration
  name: string
  description: string
  scheduledAt: Date
  payload: Record<string, unknown>
}) {
  await deleteScheduleIfPresent(input.client, input.config.groupName, input.name)
  await input.client.send(new CreateScheduleCommand({
    Name: input.name,
    GroupName: input.config.groupName,
    Description: input.description,
    ScheduleExpression: atExpression(input.scheduledAt),
    ScheduleExpressionTimezone: 'UTC',
    FlexibleTimeWindow: { Mode: 'OFF' },
    ActionAfterCompletion: 'DELETE',
    State: 'ENABLED',
    Target: {
      Arn: input.config.lambdaArn,
      RoleArn: input.config.schedulerRoleArn,
      Input: JSON.stringify(input.payload),
      RetryPolicy: {
        MaximumEventAgeInSeconds: DEFAULT_RETRY_AGE_SECONDS,
        MaximumRetryAttempts: DEFAULT_RETRY_ATTEMPTS,
      },
      ...(input.config.deadLetterArn ? { DeadLetterConfig: { Arn: input.config.deadLetterArn } } : {}),
    },
  }))
}

export async function syncEmergencyOverrideReminderSchedules(overrideId: string) {
  const config = getConfiguration()
  if (!config) {
    throw new Error(`Round scheduler is not configured: ${getRoundSchedulerConfigurationStatus().missing.join(', ')}`)
  }

  const override = await prisma.roundAutomationOverride.findUnique({
    where: { id: overrideId },
    include: { season: { select: { id: true, name: true } } },
  })
  if (!override) throw new Error(`Round automation override ${overrideId} was not found`)
  if (override.status !== 'ACTIVE' || !override.expectedEndAt) {
    return { scheduled: 0, skipped: 2 }
  }

  const now = new Date()
  const dueAt = override.expectedEndAt
  const escalationAt = new Date(dueAt.getTime() + 60 * 60 * 1000)
  const client = new SchedulerClient({ region: config.region })
  let scheduled = 0
  let skipped = 0

  try {
    const reminders = [
      {
        kind: 'due' as const,
        at: dueAt,
        eventType: 'EMERGENCY_OVERRIDE_DUE' as const,
        description: `RevME ${override.season.name} emergency round-control review reminder`,
      },
      {
        kind: 'escalation' as const,
        at: escalationAt,
        eventType: 'EMERGENCY_OVERRIDE_ESCALATION' as const,
        description: `RevME ${override.season.name} emergency round-control overdue escalation`,
      },
    ]

    for (const reminder of reminders) {
      if (reminder.at <= now) {
        skipped += 1
        continue
      }
      await createOneTimeSchedule({
        client,
        config,
        name: overrideScheduleName(override.seasonId, override.id, reminder.kind),
        description: reminder.description,
        scheduledAt: reminder.at,
        payload: {
          eventType: reminder.eventType satisfies RoundAutomationScheduleEventType,
          seasonId: override.seasonId,
          overrideId: override.id,
          idempotencyKey: [
            'round-automation-override',
            override.seasonId,
            override.id,
            reminder.kind,
            reminder.at.toISOString(),
          ].join(':'),
          scheduledFor: reminder.at.toISOString(),
        },
      })
      scheduled += 1
    }

    logger.info('Round automation emergency reminder schedules synchronized', {
      seasonId: override.seasonId,
      overrideId: override.id,
      scheduled,
      skipped,
    })
    return { scheduled, skipped }
  } finally {
    client.destroy()
  }
}
