import { describe, expect, it } from 'vitest'
import { loginAs, logout } from './auth'
import { prisma } from './db'
import { createSeasonWithRounds, createUser } from './fixtures'
import { makeRequest } from './http'

import { POST as processTransitionsRoute } from '@/app/api/admin/rounds/process-transitions/route'
import { processRoundTransitions } from '@/lib/round-scheduler'

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

    expect(result).toEqual({ opened: 1, closed: 1 })

    const [updatedOpeningRound, updatedClosingRound] = await Promise.all([
      prisma.round.findUnique({ where: { id: openingRound.id } }),
      prisma.round.findUnique({ where: { id: closingRound.id } }),
    ])

    expect(updatedOpeningRound?.status).toBe('OPEN')
    expect(updatedClosingRound?.status).toBe('CLOSED')
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
})
