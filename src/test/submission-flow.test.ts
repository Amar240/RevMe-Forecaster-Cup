import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import { makeRequest } from './http'
import {
  addTeamMember,
  createMarkets,
  createSeasonWithRounds,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'

const submissionEmailMocks = vi.hoisted(() => ({
  sendSubmissionReceiptEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/server/email', () => ({
  sendSubmissionReceiptEmail: submissionEmailMocks.sendSubmissionReceiptEmail,
}))

import { POST as submitHandler } from '@/app/api/submissions/route'
import { GET as currentSubmissionHandler } from '@/app/api/submissions/current/route'
import { GET as submissionHistoryHandler } from '@/app/api/submissions/history/route'

const BASE = 'http://localhost:5000'

function buildSubmissionEntries(
  markets: Array<{ id: string }>,
  weekOffsets: number[] = [1, 2]
) {
  return markets.flatMap((market, marketIndex) =>
    weekOffsets.map((weekOffset) => ({
      marketId: market.id,
      weekOffset,
      occupancy: 70 + marketIndex + weekOffset,
      adr: 120 + marketIndex * 10 + weekOffset,
    }))
  )
}

describe('Submission flow', () => {
  let admin: Awaited<ReturnType<typeof createUser>>
  let supervisor: Awaited<ReturnType<typeof createUser>>
  let student: Awaited<ReturnType<typeof createUser>>
  let nonSubmitter: Awaited<ReturnType<typeof createUser>>
  let university: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let rounds: Awaited<ReturnType<typeof createSeasonWithRounds>>['rounds']
  let markets: Awaited<ReturnType<typeof createMarkets>>
  let team: Awaited<ReturnType<typeof createTeam>>

  beforeEach(async () => {
    university = await createUniversity('Submission University')
    admin = await createUser({ email: 'admin@submission.test', role: 'ADMIN', universityId: university.id })
    supervisor = await createUser({
      email: 'supervisor@submission.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    student = await createUser({
      email: 'submitter@submission.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    nonSubmitter = await createUser({
      email: 'member@submission.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const seasonBundle = await createSeasonWithRounds({ status: 'ACTIVE', name: 'Submission Season' })
    season = seasonBundle.season
    rounds = seasonBundle.rounds
    markets = await createMarkets(season.id)

    team = await createTeam({
      name: 'Submission Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })

    await addTeamMember(team.id, student.id, true)
    await addTeamMember(team.id, nonSubmitter.id, false)
  })

  it('allows the team submitter to submit when the round is open', async () => {
    await loginAs(student.id)

    const req = makeRequest(`${BASE}/api/submissions`, {
      method: 'POST',
      body: {
        roundId: rounds[0].id,
        submissions: buildSubmissionEntries(markets),
      },
    })

    const res = await submitHandler(req)
    expect(res.status).toBe(201)

    const submission = await prisma.submission.findUnique({
      where: {
        teamId_roundId: {
          teamId: team.id,
          roundId: rounds[0].id,
        },
      },
    })
    expect(submission).not.toBeNull()
  })

  it('blocks a non-submitter student from submitting', async () => {
    await loginAs(nonSubmitter.id)

    const req = makeRequest(`${BASE}/api/submissions`, {
      method: 'POST',
      body: {
        roundId: rounds[0].id,
        submissions: buildSubmissionEntries(markets),
      },
    })

    const res = await submitHandler(req)
    expect(res.status).toBe(403)
  })

  it('saves all 12 values for a standard round submission', async () => {
    await loginAs(student.id)

    const entries = buildSubmissionEntries(markets)
    const req = makeRequest(`${BASE}/api/submissions`, {
      method: 'POST',
      body: {
        roundId: rounds[0].id,
        submissions: entries,
      },
    })

    const res = await submitHandler(req)
    expect(res.status).toBe(201)

    const submission = await prisma.submission.findUniqueOrThrow({
      where: {
        teamId_roundId: {
          teamId: team.id,
          roundId: rounds[0].id,
        },
      },
      include: { values: true },
    })

    expect(submission.values).toHaveLength(12)

    const occupancyValue = submission.values.find(
      (value) => value.marketId === markets[0].id && value.metric === 'OCCUPANCY' && value.weekOffset === 1
    )
    const adrValue = submission.values.find(
      (value) => value.marketId === markets[2].id && value.metric === 'ADR' && value.weekOffset === 2
    )

    expect(occupancyValue?.value).toBe(entries[0].occupancy)
    expect(adrValue?.value).toBe(entries[5].adr)
  })

  it('rejects duplicate submissions for the same round', async () => {
    await loginAs(student.id)

    const body = {
      roundId: rounds[0].id,
      submissions: buildSubmissionEntries(markets),
    }

    const firstRes = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, { method: 'POST', body })
    )
    expect(firstRes.status).toBe(201)

    const secondRes = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, { method: 'POST', body })
    )
    expect(secondRes.status).toBe(409)
  })

  it('blocks submissions when the round status is closed', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'CLOSED' },
    })

    await loginAs(student.id)
    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe('This round is closed. Submissions are no longer accepted.')
  })

  it('blocks submissions when the round status is upcoming', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'UPCOMING' },
    })

    await loginAs(student.id)
    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe('This round has not opened for submissions yet.')
  })

  it('blocks submissions when the round is paused', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: { status: 'PAUSED' },
    })

    await loginAs(student.id)
    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe('This round is temporarily paused. Submissions will resume when the round is reopened.')
  })

  it('blocks submissions after the round deadline has passed', async () => {
    await prisma.round.update({
      where: { id: rounds[0].id },
      data: {
        status: 'OPEN',
        closesAt: new Date(Date.now() - 60 * 1000),
      },
    })

    await loginAs(student.id)
    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    const data = await res.json()

    expect(res.status).toBe(422)
    expect(data.message).toBe('This round is closed. Submissions are no longer accepted.')
  })

  it('blocks submissions for a disqualified team', async () => {
    await prisma.team.update({
      where: { id: team.id },
      data: { status: 'DISQUALIFIED' },
    })

    await loginAs(student.id)
    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )

    expect(res.status).toBe(403)
  })

  it('stores submissions as locked after saving', async () => {
    await loginAs(student.id)

    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    expect(res.status).toBe(201)

    const submission = await prisma.submission.findUniqueOrThrow({
      where: {
        teamId_roundId: {
          teamId: team.id,
          roundId: rounds[0].id,
        },
      },
    })
    expect(submission.locked).toBe(true)
  })

  it('blocks a supervisor from submitting', async () => {
    await loginAs(supervisor.id)

    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )

    expect(res.status).toBe(403)
  })

  it('blocks an admin from submitting when they are not the team submitter', async () => {
    await loginAs(admin.id)

    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )

    expect(res.status).toBe(403)
  })

  it('returns current round submission state', async () => {
    await loginAs(student.id)

    const saveRes = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    expect(saveRes.status).toBe(201)

    const res = await currentSubmissionHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.currentRound.id).toBe(rounds[0].id)
    expect(data.markets).toHaveLength(3)
    expect(data.existingSubmissions).toHaveLength(6)
  })

  it('returns submission history for the student team', async () => {
    await loginAs(student.id)

    const saveRes = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: rounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    expect(saveRes.status).toBe(201)

    const res = await submissionHistoryHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.submissions.length).toBe(6)
    expect(data.submissions[0].round.number).toBe(1)
  })

  it('accepts 6 stored values for a final round submission', async () => {
    const finalRound = rounds[rounds.length - 1]

    await loginAs(student.id)
    const res = await submitHandler(
      makeRequest(`${BASE}/api/submissions`, {
        method: 'POST',
        body: {
          roundId: finalRound.id,
          submissions: buildSubmissionEntries(markets, [1]),
        },
      })
    )

    expect(res.status).toBe(201)

    const submission = await prisma.submission.findUniqueOrThrow({
      where: {
        teamId_roundId: {
          teamId: team.id,
          roundId: finalRound.id,
        },
      },
      include: { values: true },
    })
    expect(submission.values).toHaveLength(6)
  })
})
