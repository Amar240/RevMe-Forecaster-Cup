import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs } from './auth'
import {
  addTeamMember,
  createSeasonWithRounds,
  createSubmission,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'

import { GET as adminSubmissionsHandler } from '@/app/api/admin/submissions/route'

const BASE = 'http://localhost:5000'

describe('Admin submissions — week offset with dashed market IDs', () => {
  let admin: Awaited<ReturnType<typeof createUser>>
  let university: Awaited<ReturnType<typeof createUniversity>>
  let season: Awaited<ReturnType<typeof createSeasonWithRounds>>['season']
  let rounds: Awaited<ReturnType<typeof createSeasonWithRounds>>['rounds']
  let team: Awaited<ReturnType<typeof createTeam>>
  // A market id containing dashes, mimicking the gen_random_uuid() ids of the SQL-seeded markets.
  // The second hex group starts with a letter so a naive key.split('-')[1] parse yields NaN -> null.
  const dashedMarketId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  beforeEach(async () => {
    university = await createUniversity('WeekOffset University')
    admin = await createUser({ email: 'admin@weekoffset.test', role: 'ADMIN', universityId: university.id })
    const supervisor = await createUser({
      email: 'supervisor@weekoffset.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const submitter = await createUser({
      email: 'submitter@weekoffset.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const bundle = await createSeasonWithRounds({ status: 'ACTIVE', name: 'WeekOffset Season' })
    season = bundle.season
    rounds = bundle.rounds

    const market = await prisma.market.create({ data: { id: dashedMarketId, name: 'Dashed Market' } })
    await prisma.seasonMarket.create({ data: { seasonId: season.id, marketId: market.id, isActive: true } })

    team = await createTeam({
      name: 'WeekOffset Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: season.id,
      status: 'ACTIVE',
    })
    await addTeamMember(team.id, submitter.id, true)

    await createSubmission({
      teamId: team.id,
      roundId: rounds[0].id,
      submittedById: submitter.id,
      values: [
        { marketId: market.id, metric: 'OCCUPANCY', weekOffset: 1, value: 71 },
        { marketId: market.id, metric: 'ADR', weekOffset: 1, value: 121 },
        { marketId: market.id, metric: 'OCCUPANCY', weekOffset: 2, value: 82 },
        { marketId: market.id, metric: 'ADR', weekOffset: 2, value: 132 },
      ],
    })
  })

  it('returns both weeks with correct numeric offsets even when the market id contains dashes', async () => {
    await loginAs(admin.id)
    const res = await adminSubmissionsHandler()
    const data = await res.json()

    expect(res.status).toBe(200)
    const rows = data.submissions.filter((s: { marketName: string }) => s.marketName === 'Dashed Market')

    // Regression: the two weeks must survive as distinct rows with offsets 1 and 2, not NaN/null,
    // and W+2 must not overwrite W+1.
    const offsets = rows.map((r: { weekOffset: number }) => r.weekOffset).sort()
    expect(offsets).toEqual([1, 2])
    expect(rows.every((r: { weekOffset: unknown }) => typeof r.weekOffset === 'number')).toBe(true)

    const week1 = rows.find((r: { weekOffset: number }) => r.weekOffset === 1)
    const week2 = rows.find((r: { weekOffset: number }) => r.weekOffset === 2)
    expect(week1.occupancy).toBe(71)
    expect(week2.occupancy).toBe(82)
  })
})
