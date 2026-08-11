import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const schedulerMock = vi.hoisted(() => ({
  send: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock('@aws-sdk/client-scheduler', () => {
  class Command {
    constructor(public input: Record<string, unknown>) {}
  }
  return {
    SchedulerClient: class {
      send = schedulerMock.send
      destroy = schedulerMock.destroy
    },
    CreateScheduleCommand: class CreateScheduleCommand extends Command {},
    DeleteScheduleCommand: class DeleteScheduleCommand extends Command {},
    ResourceNotFoundException: class ResourceNotFoundException extends Error {},
  }
})

import { prisma } from './db'
import { createSeasonWithRounds } from './fixtures'
import { syncSeasonRoundSchedules } from '@/server/round-automation-schedules'

describe('Exact round automation schedules', () => {
  beforeEach(() => {
    schedulerMock.send.mockReset()
    schedulerMock.destroy.mockReset()
    schedulerMock.send.mockResolvedValue({})
    vi.stubEnv('AWS_REGION', 'us-east-2')
    vi.stubEnv('ROUND_AUTOMATION_LAMBDA_ARN', 'arn:aws:lambda:us-east-2:123456789012:function:round-transition')
    vi.stubEnv('ROUND_AUTOMATION_SCHEDULER_ROLE_ARN', 'arn:aws:iam::123456789012:role/round-scheduler')
    vi.stubEnv('ROUND_AUTOMATION_SCHEDULE_GROUP', 'revme-round-transitions-test')
    vi.stubEnv('ROUND_AUTOMATION_DLQ_ARN', 'arn:aws:sqs:us-east-2:123456789012:round-transition-dlq')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates exact one-time open and close schedules with retries and idempotent input', async () => {
    const startDate = new Date(Date.now() + 24 * 60 * 60 * 1_000)
    const { season } = await createSeasonWithRounds({ status: 'ACTIVE', startDate })

    const result = await syncSeasonRoundSchedules(season.id)
    const createCommands = schedulerMock.send.mock.calls
      .map(([command]) => command)
      .filter((command) => command.constructor.name === 'CreateScheduleCommand')

    expect(result).toMatchObject({ scheduled: 14, skipped: 0, generation: 1 })
    expect(createCommands).toHaveLength(14)
    expect(createCommands[0].input).toMatchObject({
      GroupName: 'revme-round-transitions-test',
      ScheduleExpressionTimezone: 'UTC',
      FlexibleTimeWindow: { Mode: 'OFF' },
      ActionAfterCompletion: 'DELETE',
      State: 'ENABLED',
      Target: {
        RetryPolicy: { MaximumEventAgeInSeconds: 3600, MaximumRetryAttempts: 5 },
        DeadLetterConfig: { Arn: 'arn:aws:sqs:us-east-2:123456789012:round-transition-dlq' },
      },
    })
    expect(createCommands[0].input.ScheduleExpression).toMatch(/^at\(\d{4}-\d{2}-\d{2}T/)
    const target = createCommands[0].input.Target as { Input: string }
    expect(JSON.parse(target.Input)).toMatchObject({ seasonId: season.id, generation: 1 })
    expect(schedulerMock.destroy).toHaveBeenCalledOnce()
    expect(await prisma.season.findUnique({ where: { id: season.id } })).toMatchObject({
      roundAutomationScheduleError: null,
    })
  })

  it('records a durable configuration error without attempting AWS', async () => {
    vi.stubEnv('ROUND_AUTOMATION_LAMBDA_ARN', '')
    vi.stubEnv('ROUND_AUTOMATION_SCHEDULER_ROLE_ARN', '')
    const { season } = await createSeasonWithRounds({ status: 'ACTIVE' })

    await expect(syncSeasonRoundSchedules(season.id)).rejects.toThrow('not configured')
    expect(schedulerMock.send).not.toHaveBeenCalled()
    expect((await prisma.season.findUnique({ where: { id: season.id } }))?.roundAutomationScheduleError)
      .toContain('ROUND_AUTOMATION_LAMBDA_ARN')
  })
})
