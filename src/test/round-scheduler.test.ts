import { describe, expect, it } from 'vitest'
import { loginAs, logout } from './auth'
import { prisma } from './db'
import { createSeasonWithRounds, createUser } from './fixtures'
import { makeRequest } from './http'

import { POST as processTransitionsRoute } from '@/app/api/admin/rounds/process-transitions/route'
import { PATCH as updateRoundStatusRoute } from '@/app/api/admin/rounds/[id]/status/route'
import {
  GET as getRoundAutomationRoute,
  PATCH as updateRoundAutomationRoute,
} from '@/app/api/admin/seasons/[seasonId]/round-automation/route'
import { processRoundTransitions, reconcileSeasonRoundState } from '@/lib/round-scheduler'
import {
  GET as cronTransitionsRoute,
  POST as scheduledTransitionRoute,
} from '@/app/api/cron/process-rounds/route'

describe('Round scheduler', () => {
  it('opens a UPCOMING round when opensAt is in the past', async () => {
    const { rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const targetRound = rounds[0]
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 60_000)

    await prisma.round.update({
      where: { id: targetRound.id },
      data: {
        status: 'UPCOMING',
        opensAt: past,
        closesAt: future,
      },
    })

    await processRoundTransitions()

    const updatedRound = await prisma.round.findUnique({ where: { id: targetRound.id } })
    expect(updatedRound?.status).toBe('OPEN')
  })

  it('closes an OPEN round when closesAt is in the past', async () => {
    const { rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const targetRound = rounds[0]
    const past = new Date(Date.now() - 60_000)

    await prisma.round.update({
      where: { id: targetRound.id },
      data: {
        status: 'OPEN',
        closesAt: past,
      },
    })

    await processRoundTransitions()

    const updatedRound = await prisma.round.findUnique({ where: { id: targetRound.id } })
    expect(updatedRound?.status).toBe('CLOSED')
  })

  it('does not touch a PAUSED round', async () => {
    const { rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const targetRound = rounds[0]
    const past = new Date(Date.now() - 60_000)

    await prisma.round.update({
      where: { id: targetRound.id },
      data: {
        status: 'PAUSED',
        opensAt: past,
        closesAt: past,
      },
    })

    await processRoundTransitions()

    const updatedRound = await prisma.round.findUnique({ where: { id: targetRound.id } })
    expect(updatedRound?.status).toBe('PAUSED')
  })

  it('does not open a round whose opensAt is in the future', async () => {
    const { rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const targetRound = rounds[0]
    const future = new Date(Date.now() + 60_000)
    const laterFuture = new Date(Date.now() + 120_000)

    await prisma.round.update({
      where: { id: targetRound.id },
      data: {
        status: 'UPCOMING',
        opensAt: future,
        closesAt: laterFuture,
      },
    })

    await processRoundTransitions()

    const updatedRound = await prisma.round.findUnique({ where: { id: targetRound.id } })
    expect(updatedRound?.status).toBe('UPCOMING')
  })

  it('does not close a round whose closesAt is in the future', async () => {
    const { rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const targetRound = rounds[0]
    const future = new Date(Date.now() + 60_000)

    await prisma.round.update({
      where: { id: targetRound.id },
      data: {
        status: 'OPEN',
        closesAt: future,
      },
    })

    await processRoundTransitions()

    const updatedRound = await prisma.round.findUnique({ where: { id: targetRound.id } })
    expect(updatedRound?.status).toBe('OPEN')
  })

  it('returns correct { opened, closed } counts', async () => {
    const { rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const openingRound = rounds[0]
    const closingRound = rounds[1]
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 60_000)

    await prisma.round.update({
      where: { id: openingRound.id },
      data: {
        status: 'UPCOMING',
        opensAt: past,
        closesAt: future,
      },
    })

    await prisma.round.update({
      where: { id: closingRound.id },
      data: {
        status: 'OPEN',
        closesAt: past,
      },
    })

    const result = await processRoundTransitions()

    expect(result).toMatchObject({ opened: 1, closed: 1 })
    expect(result.closedRoundIds).toContain(closingRound.id)

    const [updatedOpeningRound, updatedClosingRound] = await Promise.all([
      prisma.round.findUnique({ where: { id: openingRound.id } }),
      prisma.round.findUnique({ where: { id: closingRound.id } }),
    ])

    expect(updatedOpeningRound?.status).toBe('OPEN')
    expect(updatedClosingRound?.status).toBe('CLOSED')
  })

  it('closes the expired round and opens the current round in one reconciliation', async () => {
    const now = new Date()
    const { season, rounds } = await createSeasonWithRounds({
      status: 'ACTIVE',
      startDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    })
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'OPEN', closesAt: new Date(now.getTime() - 1_000) },
    })
    await prisma.round.update({
      where: { id: rounds[1].id },
      data: {
        status: 'UPCOMING',
        opensAt: new Date(now.getTime() - 500),
        closesAt: new Date(now.getTime() + 60_000),
      },
    })

    const result = await reconcileSeasonRoundState({
      seasonId: season.id,
      trigger: 'SCHEDULED',
      generation: 1,
      idempotencyKey: `scheduled:${season.id}:boundary`,
      scheduledFor: now,
      now,
    })

    expect(result).toMatchObject({ outcome: 'APPLIED', opened: 1, closed: 1 })
    const states = await prisma.round.findMany({
      where: { id: { in: [rounds[0].id, rounds[1].id] } },
      orderBy: { number: 'asc' },
      select: { status: true },
    })
    expect(states.map((round) => round.status)).toEqual(['CLOSED', 'OPEN'])
  })

  it('ignores scheduled events while a season is in manual mode', async () => {
    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await prisma.season.update({
      where: { id: season.id },
      data: { roundAutomationMode: 'MANUAL' },
    })
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'UPCOMING' },
    })

    const result = await reconcileSeasonRoundState({
      seasonId: season.id,
      trigger: 'SCHEDULED',
      generation: 1,
      idempotencyKey: `scheduled:${season.id}:manual`,
    })

    expect(result.outcome).toBe('SKIPPED')
    expect((await prisma.round.findUnique({ where: { id: rounds[0].id } }))?.status).toBe('UPCOMING')
  })

  it('ignores a scheduled event from an earlier automation generation', async () => {
    const { season } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await prisma.season.update({
      where: { id: season.id },
      data: { roundAutomationGeneration: 3 },
    })

    const result = await reconcileSeasonRoundState({
      seasonId: season.id,
      trigger: 'SCHEDULED',
      generation: 2,
      idempotencyKey: `scheduled:${season.id}:stale`,
    })
    expect(result.outcome).toBe('SKIPPED')
    expect(result.reason).toContain('earlier automation generation')
  })

  it('returns the stored result when the same scheduled event is delivered twice', async () => {
    const { season } = await createSeasonWithRounds({ status: 'ACTIVE' })
    const idempotencyKey = `scheduled:${season.id}:duplicate`
    const first = await reconcileSeasonRoundState({
      seasonId: season.id,
      trigger: 'SCHEDULED',
      generation: 1,
      idempotencyKey,
    })
    const second = await reconcileSeasonRoundState({
      seasonId: season.id,
      trigger: 'SCHEDULED',
      generation: 1,
      idempotencyKey,
    })

    expect(second.outcome).toBe(first.outcome)
    expect(await prisma.roundTransitionRun.count({ where: { idempotencyKey } })).toBe(1)
  })

  it('enforces one OPEN round per season at the database layer', async () => {
    const { rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await expect(
      prisma.round.update({ where: { id: rounds[1].id }, data: { status: 'OPEN' } })
    ).rejects.toBeDefined()
  })

  it('POST /api/admin/rounds/process-transitions requires admin auth', async () => {
    const admin = await createUser({ email: 'admin-rounds@test.com', role: 'ADMIN' })
    await loginAs(admin.id)
    logout()

    const request = makeRequest('http://localhost/api/admin/rounds/process-transitions', {
      method: 'POST',
    })

    const response = await (processTransitionsRoute as unknown as (request: Request) => Promise<Response>)(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.message).toBe('Unauthorized')
  })

  it('lets a full admin start emergency round control with an audit record', async () => {
    const admin = await createUser({ email: 'admin-mode@test.com', role: 'ADMIN' })
    const { season } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await loginAs(admin.id)

    const expectedEndAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const response = await updateRoundAutomationRoute(
      makeRequest(`http://localhost/api/admin/seasons/${season.id}/round-automation`, {
        method: 'PATCH',
        body: {
          mode: 'MANUAL',
          reason: 'Need emergency control while verifying a round boundary.',
          expectedEndAt,
          acknowledgeConsequences: true,
        },
      }),
      { params: Promise.resolve({ seasonId: season.id }) }
    )

    expect(response.status).toBe(200)
    expect(await prisma.season.findUnique({ where: { id: season.id } })).toMatchObject({
      roundAutomationMode: 'MANUAL',
      roundAutomationGeneration: 2,
    })
    expect(await prisma.roundAutomationOverride.count({
      where: { seasonId: season.id, status: 'ACTIVE' },
    })).toBe(1)
    expect(await prisma.auditLog.count({
      where: { action: 'ROUND_AUTOMATION_EMERGENCY_STARTED', entityId: season.id },
    })).toBe(1)
  })

  it('rejects direct manual round changes outside emergency control', async () => {
    const admin = await createUser({ email: 'admin-direct-round-edit@test.com', role: 'ADMIN' })
    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await loginAs(admin.id)

    const response = await updateRoundStatusRoute(
      makeRequest(`http://localhost/api/admin/rounds/${rounds[0].id}/status`, {
        method: 'PATCH',
        body: { status: 'PAUSED' },
      }),
      { params: Promise.resolve({ id: rounds[0].id }) }
    )
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('ROUND_EMERGENCY_CONTROL_REQUIRED')
    expect(await prisma.season.findUnique({ where: { id: season.id } })).toMatchObject({
      roundAutomationMode: 'AUTOMATIC',
      roundAutomationGeneration: 1,
    })
    expect(await prisma.round.findUnique({ where: { id: rounds[0].id } })).toMatchObject({
      status: 'OPEN',
    })
  })

  it('allows direct manual round changes during emergency control', async () => {
    const admin = await createUser({ email: 'admin-emergency-round-edit@test.com', role: 'ADMIN' })
    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await loginAs(admin.id)

    await updateRoundAutomationRoute(
      makeRequest(`http://localhost/api/admin/seasons/${season.id}/round-automation`, {
        method: 'PATCH',
        body: {
          mode: 'MANUAL',
          reason: 'Need emergency control while verifying round pause behavior.',
          expectedEndAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          acknowledgeConsequences: true,
        },
      }),
      { params: Promise.resolve({ seasonId: season.id }) }
    )

    const response = await updateRoundStatusRoute(
      makeRequest(`http://localhost/api/admin/rounds/${rounds[0].id}/status`, {
        method: 'PATCH',
        body: { status: 'PAUSED' },
      }),
      { params: Promise.resolve({ id: rounds[0].id }) }
    )

    expect(response.status).toBe(200)
    expect(await prisma.round.findUnique({ where: { id: rounds[0].id } })).toMatchObject({
      status: 'PAUSED',
    })
  })

  it('does not let a sub-admin change round automation mode', async () => {
    const subAdmin = await createUser({ email: 'subadmin-mode@test.com', role: 'SUB_ADMIN' })
    const { season } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await loginAs(subAdmin.id)

    const response = await updateRoundAutomationRoute(
      makeRequest(`http://localhost/api/admin/seasons/${season.id}/round-automation`, {
        method: 'PATCH',
        body: { mode: 'MANUAL', reason: 'Attempted emergency change' },
      }),
      { params: Promise.resolve({ seasonId: season.id }) }
    )

    expect(response.status).toBe(403)
    expect((await prisma.season.findUnique({ where: { id: season.id } }))?.roundAutomationMode)
      .toBe('AUTOMATIC')
  })

  it('reports scheduler infrastructure and the next boundary to an admin', async () => {
    const admin = await createUser({ email: 'admin-status@test.com', role: 'ADMIN' })
    const { season } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await loginAs(admin.id)

    const response = await getRoundAutomationRoute(
      makeRequest(`http://localhost/api/admin/seasons/${season.id}/round-automation`),
      { params: Promise.resolve({ seasonId: season.id }) }
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ seasonId: season.id, mode: 'AUTOMATIC' })
    expect(body.infrastructure).toHaveProperty('configured')
    expect(body.nextTransition).toMatchObject({ roundNumber: 1 })
  })

  it('cron endpoint fails closed when CRON_SECRET is missing', async () => {
    const previous = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    const response = await cronTransitionsRoute(makeRequest('http://localhost/api/cron/process-rounds'))
    expect(response.status).toBe(503)
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  })

  it('cron endpoint rejects an invalid bearer token', async () => {
    const previous = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'expected-secret'
    const response = await cronTransitionsRoute(makeRequest('http://localhost/api/cron/process-rounds', { headers: { authorization: 'Bearer wrong-secret' } }))
    expect(response.status).toBe(401)
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  })

  it('processes an authenticated exact-boundary event once', async () => {
    const previous = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'expected-secret'
    const now = new Date()
    const { season, rounds } = await createSeasonWithRounds({ status: 'ACTIVE' })
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: {
        status: 'UPCOMING',
        opensAt: new Date(now.getTime() - 1_000),
        closesAt: new Date(now.getTime() + 60_000),
      },
    })
    const idempotencyKey = `scheduled:${season.id}:api-boundary`
    const requestBody = {
      seasonId: season.id,
      generation: 1,
      idempotencyKey,
      scheduledFor: now.toISOString(),
    }

    const first = await scheduledTransitionRoute(makeRequest(
      'http://localhost/api/cron/process-rounds',
      {
        method: 'POST',
        headers: { authorization: 'Bearer expected-secret' },
        body: requestBody,
      }
    ))
    const second = await scheduledTransitionRoute(makeRequest(
      'http://localhost/api/cron/process-rounds',
      {
        method: 'POST',
        headers: { authorization: 'Bearer expected-secret' },
        body: requestBody,
      }
    ))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await prisma.roundTransitionRun.count({ where: { idempotencyKey } })).toBe(1)
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  })
})
