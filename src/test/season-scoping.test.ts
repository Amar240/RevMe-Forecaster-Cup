import { describe, expect, it } from 'vitest'
import { prisma } from './db'
import { loginAs, logout } from './auth'
import {
  addTeamMember,
  createActual,
  createSeasonWithRounds,
  createSubmission,
  createTeam,
  createUniversity,
  createUser,
} from './fixtures'
import { getCurrentOperationalSeason } from '@/server/season'
import { GET as getCurrentUser } from '@/app/api/users/me/route'
import { GET as getSubmissionHistory } from '@/app/api/submissions/history/route'
import { GET as getCurrentSubmissions } from '@/app/api/submissions/current/route'
import { GET as getAdminSubmissions } from '@/app/api/admin/submissions/route'
import { GET as getAdminTeams } from '@/app/api/admin/teams/route'
import { GET as getCommandCenter } from '@/app/api/admin/command-center/route'
import { GET as getSubmissionTracker } from '@/app/api/admin/submissions/tracker/route'
import { GET as getCurrentSupervisor } from '@/app/api/user/supervisor/route'
import { GET as getLeaderboards } from '@/app/api/leaderboards/route'
import { GET as getScoringVerification } from '@/app/api/scoring/verification/route'
import { GET as getActuals } from '@/app/api/admin/actuals/route'
import { GET as getActualsSummary } from '@/app/api/admin/actuals/summary/route'
import { GET as getScoringStatus } from '@/app/api/admin/scoring/status/route'
import { GET as getScoringAnomalies } from '@/app/api/admin/scoring/anomalies/route'
import { GET as getScoringPreflight } from '@/app/api/admin/scoring/preflight/route'
import { POST as postScoringRun } from '@/app/api/admin/scoring/run/route'
import { GET as getInstructorReport } from '@/app/api/admin/reports/instructor/route'
import { POST as createTeamHandler } from '@/app/api/teams/route'
import { POST as postJoinRequest } from '@/app/api/join-requests/route'
import { GET as getJoinableTeams } from '@/app/api/join-requests/teams/route'
import { POST as postSupervisorJoinRequest } from '@/app/api/supervisor/join-requests/route'
import { POST as postSupportTicket } from '@/app/api/support-tickets/route'
import { POST as postSubmission } from '@/app/api/submissions/route'
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

function buildSubmissionEntries(
  markets: Array<{ id: string }>,
  options: { isFinal?: boolean } = {}
) {
  const weekOffsets = options.isFinal ? [1] : [1, 2]

  return markets.flatMap((market, marketIndex) =>
    weekOffsets.map((weekOffset) => ({
      marketId: market.id,
      weekOffset,
      occupancy: 70 + marketIndex + weekOffset,
      adr: 180 + marketIndex * 10 + weekOffset,
    }))
  )
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

    const historyRes = await getSubmissionHistory(makeRequest('http://localhost:5000/api/submissions/history'))
    expect(historyRes.status).toBe(200)
    const historyData = await historyRes.json()
    expect(historyData.submissions).toHaveLength(1)
    expect(historyData.submissions[0].occupancy).toBe(81)
  })

  it('uses the current season team for submission, supervisor, support, leaderboard, and verification reads', async () => {
    const university = await createUniversity('Operational Membership University')
    const oldSupervisor = await createUser({
      email: 'old-supervisor@operational-membership.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const currentSupervisor = await createUser({
      email: 'current-supervisor@operational-membership.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@operational-membership.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const { season: oldSeason, rounds: oldRounds } = await createSeasonWithRounds({
      name: 'Completed Operational Season',
      status: 'ACTIVE',
    })
    const [oldMarket] = await attachStandardMarkets(oldSeason.id)
    await prisma.season.update({
      where: { id: oldSeason.id },
      data: { status: 'COMPLETED' },
    })

    const { season: currentSeason, rounds: currentRounds } = await createSeasonWithRounds({
      name: 'Current Operational Season',
      status: 'ACTIVE',
    })
    const [currentMarket] = await attachStandardMarkets(currentSeason.id)

    const oldTeam = await createTeam({
      name: 'Old Operational Team',
      supervisorId: oldSupervisor.id,
      universityId: university.id,
      seasonId: oldSeason.id,
    })
    const currentTeam = await createTeam({
      name: 'Current Operational Team',
      supervisorId: currentSupervisor.id,
      universityId: university.id,
      seasonId: currentSeason.id,
    })

    await addTeamMember(oldTeam.id, student.id, true)
    await addTeamMember(currentTeam.id, student.id, true)

    await createSubmission({
      teamId: oldTeam.id,
      roundId: oldRounds[0].id,
      submittedById: student.id,
      values: [{ marketId: oldMarket.id, metric: 'OCCUPANCY', weekOffset: 1, value: 70 }],
    })
    await createSubmission({
      teamId: currentTeam.id,
      roundId: currentRounds[0].id,
      submittedById: student.id,
      values: [
        { marketId: currentMarket.id, metric: 'OCCUPANCY', weekOffset: 1, value: 82 },
        { marketId: currentMarket.id, metric: 'ADR', weekOffset: 1, value: 210 },
      ],
    })

    await loginAs(student.id)

    const [currentSubmissionRes, currentSupervisorRes, leaderboardRes, verificationRes, supportTicketRes] = await Promise.all([
      getCurrentSubmissions(),
      getCurrentSupervisor(),
      getLeaderboards(makeRequest('http://localhost/api/leaderboards')),
      getScoringVerification(makeRequest('http://localhost/api/scoring/verification')),
      postSupportTicket(
        makeRequest('http://localhost/api/support-tickets', {
          method: 'POST',
          body: {
            subject: 'Need help with current round',
            message: 'Please confirm my current team support path.',
          },
        })
      ),
    ])

    expect(currentSubmissionRes.status).toBe(200)
    const currentSubmissionData = await currentSubmissionRes.json()
    expect(currentSubmissionData.canSubmit).toBe(true)
    expect(currentSubmissionData.currentRound.id).toBe(currentRounds[0].id)
    expect(currentSubmissionData.existingSubmissions.some((entry: { occupancy: number }) => entry.occupancy === 82)).toBe(true)

    expect(currentSupervisorRes.status).toBe(200)
    const currentSupervisorData = await currentSupervisorRes.json()
    expect(currentSupervisorData.supervisor.id).toBe(currentSupervisor.id)

    expect(leaderboardRes.status).toBe(200)
    const leaderboardData = await leaderboardRes.json()
    expect(leaderboardData.myTeamId).toBe(currentTeam.id)

    expect(verificationRes.status).toBe(200)
    const verificationData = await verificationRes.json()
    expect(verificationData.selectedTeamId).toBe(currentTeam.id)

    expect(supportTicketRes.status).toBe(200)
    const supportTicketData = await supportTicketRes.json()
    expect(supportTicketData.ticket.teamId).toBe(currentTeam.id)
    expect(supportTicketData.ticket.supervisorId).toBe(currentSupervisor.id)
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

  it('keeps ACTIVE precedence over a newer PAUSED season for operational reads', async () => {
    await createSeasonWithRounds({
      name: 'Operational Active Season',
      status: 'ACTIVE',
    })
    await createSeasonWithRounds({
      name: 'Newer Paused Season',
      status: 'PAUSED',
    })

    logout()
    const res = await getLeaderboards(makeRequest('http://localhost/api/leaderboards'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.seasonName).toBe('Operational Active Season')
  })

  it('does not fall back to completed seasons when no operational season exists', async () => {
    const { season } = await createSeasonWithRounds({
      name: 'Completed Leaderboard Season',
      status: 'ACTIVE',
    })

    await prisma.season.update({
      where: { id: season.id },
      data: { status: 'COMPLETED' },
    })

    logout()
    const res = await getLeaderboards(makeRequest('http://localhost/api/leaderboards'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.seasonName).toBe('')
    expect(data.leaderboard).toEqual([])
    expect(data.rounds).toEqual([])
  })

  it('uses the paused season for leaderboard and scoring verification when no active season exists', async () => {
    const university = await createUniversity('Paused Leaderboard University')
    const supervisor = await createUser({
      email: 'supervisor@paused-leaderboard.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@paused-leaderboard.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const { season: pausedSeason } = await createSeasonWithRounds({
      name: 'Paused Leaderboard Season',
      status: 'PAUSED',
    })

    await attachStandardMarkets(pausedSeason.id)

    const pausedTeam = await createTeam({
      name: 'Paused Leaderboard Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: pausedSeason.id,
      status: 'ACTIVE',
    })
    await addTeamMember(pausedTeam.id, student.id, true)

    await loginAs(student.id)

    const [leaderboardRes, verificationRes] = await Promise.all([
      getLeaderboards(makeRequest('http://localhost/api/leaderboards')),
      getScoringVerification(makeRequest('http://localhost/api/scoring/verification')),
    ])

    expect(leaderboardRes.status).toBe(200)
    const leaderboardData = await leaderboardRes.json()
    expect(leaderboardData.seasonName).toBe(pausedSeason.name)
    expect(leaderboardData.myTeamId).toBe(pausedTeam.id)

    expect(verificationRes.status).toBe(200)
    const verificationData = await verificationRes.json()
    expect(verificationData.seasonName).toBe(pausedSeason.name)
    expect(verificationData.selectedTeamId).toBe(pausedTeam.id)
  })

  it('uses the paused season for admin actuals, scoring, and instructor report views', async () => {
    const university = await createUniversity('Paused Admin Operations University')
    const admin = await createUser({
      email: 'admin@paused-admin-ops.test',
      role: 'ADMIN',
      universityId: university.id,
    })
    const supervisor = await createUser({
      email: 'supervisor@paused-admin-ops.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const student = await createUser({
      email: 'student@paused-admin-ops.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const { season: pausedSeason, rounds: pausedRounds } = await createSeasonWithRounds({
      name: 'Paused Admin Season',
      status: 'PAUSED',
    })
    const markets = await attachStandardMarkets(pausedSeason.id)

    const pausedTeam = await createTeam({
      name: 'Paused Report Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: pausedSeason.id,
      status: 'ACTIVE',
    })
    await addTeamMember(pausedTeam.id, student.id, true)
    await createSubmission({
      teamId: pausedTeam.id,
      roundId: pausedRounds[0].id,
      submittedById: student.id,
      values: [
        { marketId: markets[0].id, metric: 'OCCUPANCY', weekOffset: 1, value: 82 },
        { marketId: markets[0].id, metric: 'ADR', weekOffset: 1, value: 195 },
      ],
    })
    await createActual({
      seasonId: pausedSeason.id,
      roundId: pausedRounds[0].id,
      marketId: markets[0].id,
      metric: 'OCCUPANCY',
      weekOffset: 1,
      value: 80,
      createdById: admin.id,
    })

    await loginAs(admin.id)

    const [actualsRes, summaryRes, statusRes, anomaliesRes, preflightRes, reportRes] = await Promise.all([
      getActuals(makeRequest(`http://localhost/api/admin/actuals?roundId=${pausedRounds[0].id}`)),
      getActualsSummary(makeRequest('http://localhost/api/admin/actuals/summary')),
      getScoringStatus(),
      getScoringAnomalies(),
      getScoringPreflight(),
      getInstructorReport(makeRequest('http://localhost/api/admin/reports/instructor')),
    ])

    expect(actualsRes.status).toBe(200)
    const actualsData = await actualsRes.json()
    expect(actualsData.actuals).toHaveLength(1)
    expect(actualsData.actuals[0].roundId).toBe(pausedRounds[0].id)
    expect(actualsData.actuals[0].value).toBe(80)
    expect(actualsData.rounds).toHaveLength(7)

    expect(summaryRes.status).toBe(200)
    const summaryData = await summaryRes.json()
    expect(summaryData.actuals).toHaveLength(1)
    expect(summaryData.actuals[0].roundId).toBe(pausedRounds[0].id)

    expect(statusRes.status).toBe(200)
    const statusData = await statusRes.json()
    expect(statusData.seasonName).toBe(pausedSeason.name)

    expect(anomaliesRes.status).toBe(200)
    const anomaliesData = await anomaliesRes.json()
    expect(anomaliesData.roundNumber).toBe(7)

    expect(preflightRes.status).toBe(200)
    const preflightData = await preflightRes.json()
    expect(preflightData.seasonName).toBe(pausedSeason.name)

    expect(reportRes.status).toBe(200)
    const csv = await reportRes.text()
    expect(csv).toContain('Paused Report Team')

    const runRes = await postScoringRun(
      makeRequest('http://localhost/api/admin/scoring/run', {
        method: 'POST',
        body: { scope: 'SEASON' },
      })
    )
    const runData = await runRes.json()

    expect(runRes.status).toBe(200)
    expect(runData.status).toBe('SUCCESS')

    const latestRun = await prisma.scoringRun.findFirst({
      orderBy: { startedAt: 'desc' },
    })
    expect(latestRun?.seasonId).toBe(pausedSeason.id)
  })

  it('creates teams and join requests in the paused operational season while submissions remain blocked', async () => {
    const university = await createUniversity('Paused Membership University')
    const supervisor = await createUser({
      email: 'supervisor@paused-membership.test',
      role: 'SUPERVISOR',
      universityId: university.id,
    })
    const joinRequester = await createUser({
      email: 'join-requester@paused-membership.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const implicitRequester = await createUser({
      email: 'implicit-requester@paused-membership.test',
      role: 'STUDENT',
      universityId: university.id,
    })
    const submitter = await createUser({
      email: 'submitter@paused-membership.test',
      role: 'STUDENT',
      universityId: university.id,
    })

    const { season: pausedSeason, rounds: pausedRounds } = await createSeasonWithRounds({
      name: 'Paused Membership Season',
      status: 'PAUSED',
    })
    const markets = await attachStandardMarkets(pausedSeason.id)

    const joinableTeam = await createTeam({
      name: 'Paused Joinable Team',
      supervisorId: supervisor.id,
      universityId: university.id,
      seasonId: pausedSeason.id,
      status: 'ACTIVE',
    })
    await addTeamMember(joinableTeam.id, submitter.id, true)

    await loginAs(supervisor.id)
    const createTeamRes = await createTeamHandler(
      makeRequest('http://localhost/api/teams', {
        method: 'POST',
        body: { name: 'Paused Created Team' },
      })
    )
    const createdTeamData = await createTeamRes.json()

    expect(createTeamRes.status).toBe(201)
    expect(createdTeamData.team.seasonId).toBe(pausedSeason.id)

    await loginAs(joinRequester.id)
    const joinRequestRes = await postJoinRequest(
      makeRequest('http://localhost/api/join-requests', {
        method: 'POST',
        body: {
          supervisorId: supervisor.id,
          teamId: joinableTeam.id,
          message: 'Please add me to the paused-season team.',
        },
      })
    )
    const joinRequestData = await joinRequestRes.json()

    expect(joinRequestRes.status).toBe(200)
    expect(joinRequestData.request.seasonId).toBe(pausedSeason.id)

    const joinableTeamsRes = await getJoinableTeams(
      makeRequest(`http://localhost/api/join-requests/teams?supervisorId=${supervisor.id}`)
    )
    const joinableTeamsData = await joinableTeamsRes.json()

    expect(joinableTeamsRes.status).toBe(200)
    expect(joinableTeamsData.teams.some((team: { id: string }) => team.id === joinableTeam.id)).toBe(true)

    await loginAs(implicitRequester.id)
    const implicitJoinRequestRes = await postJoinRequest(
      makeRequest('http://localhost/api/join-requests', {
        method: 'POST',
        body: {
          supervisorId: supervisor.id,
          message: 'Please place me on a new paused-season team.',
        },
      })
    )
    const implicitJoinRequestData = await implicitJoinRequestRes.json()

    expect(implicitJoinRequestRes.status).toBe(200)
    expect(implicitJoinRequestData.request.seasonId).toBe(pausedSeason.id)

    await loginAs(supervisor.id)
    const supervisorAcceptRes = await postSupervisorJoinRequest(
      makeRequest('http://localhost/api/supervisor/join-requests', {
        method: 'POST',
        body: {
          requestId: implicitJoinRequestData.request.id,
          action: 'accept',
          teamName: 'Paused Intake Team',
        },
      })
    )

    expect(supervisorAcceptRes.status).toBe(200)

    const pausedIntakeTeam = await prisma.team.findFirstOrThrow({
      where: { name: 'Paused Intake Team' },
    })
    expect(pausedIntakeTeam.seasonId).toBe(pausedSeason.id)

    await loginAs(submitter.id)
    const submissionRes = await postSubmission(
      makeRequest('http://localhost/api/submissions', {
        method: 'POST',
        body: {
          roundId: pausedRounds[0].id,
          submissions: buildSubmissionEntries(markets),
        },
      })
    )
    const submissionData = await submissionRes.json()

    expect(submissionRes.status).toBe(400)
    expect(submissionData.message).toBe('Season is not active')
  })
})
