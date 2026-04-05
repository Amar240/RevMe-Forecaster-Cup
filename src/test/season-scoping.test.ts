import { describe, expect, it } from 'vitest'
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
import { getCurrentOperationalSeason } from '@/server/season'
import { GET as getCurrentUser } from '@/app/api/users/me/route'
import { GET as getSubmissionHistory } from '@/app/api/submissions/history/route'
import { GET as getAdminSubmissions } from '@/app/api/admin/submissions/route'
import { GET as getAdminTeams } from '@/app/api/admin/teams/route'
import { GET as getCommandCenter } from '@/app/api/admin/command-center/route'
import { GET as getSubmissionTracker } from '@/app/api/admin/submissions/tracker/route'
import { makeRequest } from './http'

async function attachStandardMarkets(seasonId: string) {
  const marketNames = ['Nashville CBD', 'Dubai', 'Hamburg']
  const markets = await Promise.all(
    marketNames.map((name) =>
      prisma.market.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  )

  await prisma.seasonMarket.createMany({
    data: markets.map((market) => ({
      seasonId,
      marketId: market.id,
      isActive: true,
    })),
  })

  return markets
}

describe('current operational season scoping', () => {
  it('prefers ACTIVE and otherwise falls back to PAUSED', async () => {
    expect(await getCurrentOperationalSeason()).toBeNull()

    const { season: pausedSeason } = await createSeasonWithRounds({
      name: 'Paused Season',
      status: 'PAUSED',
    })

    expect((await getCurrentOperationalSeason())?.id).toBe(pausedSeason.id)

    const { season: activeSeason } = await createSeasonWithRounds({
      name: 'Active Season',
      status: 'ACTIVE',
    })

    expect((await getCurrentOperationalSeason())?.id).toBe(activeSeason.id)

    await prisma.season.update({
      where: { id: activeSeason.id },
      data: { status: 'COMPLETED' },
    })

    expect((await getCurrentOperationalSeason())?.id).toBe(pausedSeason.id)
  })

  it('scopes users/me and submission history to the current operational season only', async () => {
    const university = await createUniversity('Season Scope University')
    const supervisor = await createUser({
      email: 'supervisor@season-scope.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@season-scope.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const { season: oldSeason, rounds: oldRounds } = await createSeasonWithRounds({
      name: 'Completed Season',
      status: 'ACTIVE',
    })
    const [oldMarket] = await attachStandardMarkets(oldSeason.id)
    await prisma.season.update({
      where: { id: oldSeason.id },
      data: { status: 'COMPLETED' },
    })

    const { season: currentSeason, rounds: currentRounds } = await createSeasonWithRounds({
      name: 'Current Season',
      status: 'ACTIVE',
    })
    const [currentMarket] = await attachStandardMarkets(currentSeason.id)

    const oldTeam = await createTeam({
      name: 'Old Season Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: oldSeason.id,
    })
    const currentTeam = await createTeam({
      name: 'Current Season Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: currentSeason.id,
    })

    await addTeamMember(oldTeam.id, student.id, true)
    await addTeamMember(currentTeam.id, student.id, true)

    await createSubmission({
      teamId: oldTeam.id,
      roundId: oldRounds[0].id,
      submittedById: student.id,
      values: [{ marketId: oldMarket.id, metric: 'OCCUPANCY', weekOffset: 1, value: 75 }],
    })
    await createSubmission({
      teamId: currentTeam.id,
      roundId: currentRounds[0].id,
      submittedById: student.id,
      values: [{ marketId: currentMarket.id, metric: 'OCCUPANCY', weekOffset: 1, value: 81 }],
    })

    await loginAs(student.id)

    const userRes = await getCurrentUser()
    expect(userRes.status).toBe(200)
    const userData = await userRes.json()
    expect(userData.user.email).toBe(student.email)
    expect(userData.user.teamMemberships).toHaveLength(1)
    expect(userData.user.teamMemberships[0].team.name).toBe('Current Season Team')

    const historyRes = await getSubmissionHistory()
    expect(historyRes.status).toBe(200)
    const historyData = await historyRes.json()
    expect(historyData.submissions).toHaveLength(1)
    expect(historyData.submissions[0].occupancy).toBe(81)
  })

  it('defaults admin submissions explorer to the current operational season', async () => {
    const university = await createUniversity('Admin Season Scope University')
    const admin = await createUser({
      email: 'admin@season-admin.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'supervisor@season-admin.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@season-admin.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const { season: oldSeason, rounds: oldRounds } = await createSeasonWithRounds({
      name: 'Completed Admin Season',
      status: 'ACTIVE',
    })
    const [oldMarket] = await attachStandardMarkets(oldSeason.id)
    await prisma.season.update({
      where: { id: oldSeason.id },
      data: { status: 'COMPLETED' },
    })

    const { season: currentSeason, rounds: currentRounds } = await createSeasonWithRounds({
      name: 'Current Admin Season',
      status: 'ACTIVE',
    })
    const [currentMarket] = await attachStandardMarkets(currentSeason.id)

    const oldTeam = await createTeam({
      name: 'Completed Season Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: oldSeason.id,
    })
    const currentTeam = await createTeam({
      name: 'Active Season Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: currentSeason.id,
    })

    await addTeamMember(oldTeam.id, student.id, true)
    await addTeamMember(currentTeam.id, student.id, true)

    await createSubmission({
      teamId: oldTeam.id,
      roundId: oldRounds[0].id,
      submittedById: student.id,
      values: [{ marketId: oldMarket.id, metric: 'ADR', weekOffset: 1, value: 150 }],
    })
    await createSubmission({
      teamId: currentTeam.id,
      roundId: currentRounds[0].id,
      submittedById: student.id,
      values: [{ marketId: currentMarket.id, metric: 'ADR', weekOffset: 1, value: 175 }],
    })

    await loginAs(admin.id)

    const res = await getAdminSubmissions()
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.totalSubmissions).toBe(1)
    expect(data.submissions).toHaveLength(1)
    expect(data.submissions[0].teamName).toBe('Active Season Team')
  })

  it('defaults admin teams to the current operational season and allows explicit season overrides', async () => {
    const university = await createUniversity('Admin Teams Scope University')
    const admin = await createUser({
      email: 'admin@teams-scope.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'supervisor@teams-scope.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })

    const { season: oldSeason } = await createSeasonWithRounds({
      name: 'Old Completed Season',
      status: 'ACTIVE',
    })
    await prisma.season.update({
      where: { id: oldSeason.id },
      data: { status: 'COMPLETED' },
    })

    const { season: currentSeason } = await createSeasonWithRounds({
      name: 'Current Teams Season',
      status: 'ACTIVE',
    })

    const oldTeam = await createTeam({
      name: 'Completed Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: oldSeason.id,
      status: 'ACTIVE',
    })
    const currentTeam = await createTeam({
      name: 'Current Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: currentSeason.id,
      status: 'ACTIVE',
    })

    await loginAs(admin.id)

    const defaultRes = await getAdminTeams(makeRequest('http://localhost/api/admin/teams'))
    expect(defaultRes.status).toBe(200)
    const defaultData = await defaultRes.json()

    expect(defaultData.season.id).toBe(currentSeason.id)
    expect(defaultData.summary.activeTeams).toBe(1)
    expect(defaultData.teams).toHaveLength(1)
    expect(defaultData.teams[0].id).toBe(currentTeam.id)

    const explicitRes = await getAdminTeams(
      makeRequest(`http://localhost/api/admin/teams?seasonId=${oldSeason.id}`)
    )
    expect(explicitRes.status).toBe(200)
    const explicitData = await explicitRes.json()

    expect(explicitData.season.id).toBe(oldSeason.id)
    expect(explicitData.summary.activeTeams).toBe(1)
    expect(explicitData.teams).toHaveLength(1)
    expect(explicitData.teams[0].id).toBe(oldTeam.id)
  })

  it('keeps dashboard and tracker aligned on the same active-team denominator, including PAUSED fallback', async () => {
    const university = await createUniversity('Command Center Scope University')
    const admin = await createUser({
      email: 'admin@command-center-scope.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'supervisor@command-center-scope.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })

    const { season: oldSeason } = await createSeasonWithRounds({
      name: 'Completed Tracker Season',
      status: 'ACTIVE',
    })
    await prisma.season.update({
      where: { id: oldSeason.id },
      data: { status: 'COMPLETED' },
    })

    const { season: pausedSeason, rounds } = await createSeasonWithRounds({
      name: 'Paused Current Season',
      status: 'PAUSED',
    })

    await createTeam({
      name: 'Completed Old Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: oldSeason.id,
      status: 'ACTIVE',
    })
    const activePausedTeam = await createTeam({
      name: 'Paused Active Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: pausedSeason.id,
      status: 'ACTIVE',
    })
    await createTeam({
      name: 'Paused Draft Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: pausedSeason.id,
      status: 'DRAFT',
    })

    await loginAs(admin.id)

    const [commandCenterRes, trackerRes] = await Promise.all([
      getCommandCenter(),
      getSubmissionTracker(),
    ])

    expect(commandCenterRes.status).toBe(200)
    expect(trackerRes.status).toBe(200)

    const commandCenterData = await commandCenterRes.json()
    const trackerData = await trackerRes.json()

    expect(commandCenterData.activeSeason.id).toBe(pausedSeason.id)
    expect(commandCenterData.activeSeason.status).toBe('PAUSED')
    expect(commandCenterData.stats.totalTeams).toBe(2)
    expect(commandCenterData.stats.activeTeams).toBe(1)
    expect(commandCenterData.submissionProgress.total).toBe(1)
    expect(commandCenterData.submissionProgress.pending).toBe(1)

    expect(trackerData.round.id).toBe(rounds[0].id)
    expect(trackerData.summary.total).toBe(1)
    expect(trackerData.summary.submitted).toBe(0)
    expect(trackerData.summary.missing).toBe(1)
    expect(trackerData.teams).toHaveLength(1)
    expect(trackerData.teams[0].id).toBe(activePausedTeam.id)
  })
})
