import { describe, expect, it } from 'vitest'
import { buildCommandCenterDisplay } from '@/components/admin/command-center/command-center-display'
import type { DashboardData } from '@/components/admin/command-center/command-center-types'

const NOW = new Date('2026-04-05T16:00:00.000Z')

function makeDashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    activeSeason: {
      id: 'season-active',
      name: 'Spring 2026',
      status: 'ACTIVE',
    },
    currentRound: {
      id: 'round-1',
      number: 1,
      opensAt: '2026-04-05T12:00:00.000Z',
      closesAt: '2026-04-06T16:00:00.000Z',
      status: 'Open',
      leaderboardReviewed: false,
      participantsNotified: false,
    },
    stats: {
      totalTeams: 8,
      activeTeams: 8,
      disqualifiedTeams: 2,
      totalUsers: 30,
      totalSubmissions: 8,
      currentRoundSubmissions: 6,
      totalWarnings: 3,
      teamsWithActuals: 0,
      scoredSubmissions: 0,
      oneWarningTeams: 2,
      twoWarningTeams: 1,
    },
    meta: {
      weekOffsets: [1, 2],
      lastScoredAt: null,
      lastActualsUploadAt: null,
      expectedErrors: 16,
      pendingTeamApprovals: 1,
      activeMarketCount: 2,
    },
    submissionProgress: {
      submitted: 6,
      pending: 2,
      total: 8,
    },
    rounds: [
      {
        id: 'round-1',
        number: 1,
        opensAt: '2026-04-05T12:00:00.000Z',
        closesAt: '2026-04-06T16:00:00.000Z',
        status: 'OPEN',
        submissionCount: 6,
        hasActuals: false,
        isScored: false,
      },
      {
        id: 'round-2',
        number: 2,
        opensAt: '2026-04-12T12:00:00.000Z',
        closesAt: '2026-04-13T16:00:00.000Z',
        status: 'UPCOMING',
        submissionCount: 0,
        hasActuals: false,
        isScored: false,
      },
    ],
    ...overrides,
  }
}

describe('buildCommandCenterDisplay', () => {
  it('shows the active round with a coherent open badge', () => {
    const display = buildCommandCenterDisplay(makeDashboardData(), NOW)

    expect(display.roundLabel).toBe('Round 1')
    expect(display.roundBadge).toEqual({ label: 'Open', tone: 'success' })
    expect(display.deadlineLabel).toContain('ET')
    expect(display.primaryAction.title).toBe('Send reminders')
  })

  it('shows closing soon when the current round status says so', () => {
    const display = buildCommandCenterDisplay(
      makeDashboardData({
        currentRound: {
          id: 'round-1',
          number: 1,
          opensAt: '2026-04-05T12:00:00.000Z',
          closesAt: '2026-04-05T18:00:00.000Z',
          status: 'Closing Soon',
          leaderboardReviewed: false,
          participantsNotified: false,
        },
      }),
      NOW
    )

    expect(display.roundBadge).toEqual({ label: 'Closing Soon', tone: 'warning' })
  })

  it('falls back to upcoming when there is no active round but a future round exists', () => {
    const display = buildCommandCenterDisplay(
      makeDashboardData({
        currentRound: null,
        submissionProgress: { submitted: 0, pending: 0, total: 8 },
        rounds: [
          {
            id: 'round-2',
            number: 2,
            opensAt: '2026-04-12T12:00:00.000Z',
            closesAt: '2026-04-13T16:00:00.000Z',
            status: 'UPCOMING',
            submissionCount: 0,
            hasActuals: false,
            isScored: false,
          },
        ],
      }),
      NOW
    )

    expect(display.roundLabel).toBe('No active round')
    expect(display.roundBadge).toEqual({ label: 'Upcoming', tone: 'info' })
  })

  it('falls back to closed when only past rounds remain', () => {
    const display = buildCommandCenterDisplay(
      makeDashboardData({
        currentRound: null,
        submissionProgress: { submitted: 0, pending: 0, total: 8 },
        rounds: [
          {
            id: 'round-1',
            number: 1,
            opensAt: '2026-03-20T12:00:00.000Z',
            closesAt: '2026-03-21T16:00:00.000Z',
            status: 'CLOSED',
            submissionCount: 8,
            hasActuals: false,
            isScored: false,
          },
        ],
      }),
      NOW
    )

    expect(display.roundLabel).toBe('No active round')
    expect(display.roundBadge).toEqual({ label: 'Closed', tone: 'neutral' })
    expect(display.scoringStatus).toBe('Awaiting Actuals')
  })

  it('shows a needs-setup fallback when there is no operational season', () => {
    const display = buildCommandCenterDisplay(
      makeDashboardData({
        activeSeason: null,
        currentRound: null,
        submissionProgress: { submitted: 0, pending: 0, total: 0 },
        rounds: [],
      }),
      NOW
    )

    expect(display.roundLabel).toBe('No active season')
    expect(display.roundBadge).toEqual({ label: 'Needs setup', tone: 'neutral' })
    expect(display.primaryRiskText).toContain('No operational season is active')
    expect(display.scoringStatus).toBe('Idle')
  })

  it('derives scoring readiness states from latest closed rounds', () => {
    const readyDisplay = buildCommandCenterDisplay(
      makeDashboardData({
        currentRound: null,
        rounds: [
          {
            id: 'round-1',
            number: 1,
            opensAt: '2026-03-20T12:00:00.000Z',
            closesAt: '2026-03-21T16:00:00.000Z',
            status: 'CLOSED',
            submissionCount: 8,
            hasActuals: true,
            isScored: false,
          },
        ],
      }),
      NOW
    )

    const scoredDisplay = buildCommandCenterDisplay(
      makeDashboardData({
        currentRound: null,
        rounds: [
          {
            id: 'round-1',
            number: 1,
            opensAt: '2026-03-20T12:00:00.000Z',
            closesAt: '2026-03-21T16:00:00.000Z',
            status: 'CLOSED',
            submissionCount: 8,
            hasActuals: true,
            isScored: true,
          },
        ],
      }),
      NOW
    )

    expect(readyDisplay.scoringStatus).toBe('Ready')
    expect(scoredDisplay.scoringStatus).toBe('Scored')
  })

  it('prioritizes missing submissions over lower-severity risks', () => {
    const display = buildCommandCenterDisplay(
      makeDashboardData({
        meta: {
          weekOffsets: [1, 2],
          lastScoredAt: null,
          lastActualsUploadAt: null,
          expectedErrors: 16,
          pendingTeamApprovals: 4,
          activeMarketCount: 2,
        },
        stats: {
          totalTeams: 8,
          activeTeams: 8,
          disqualifiedTeams: 5,
          totalUsers: 30,
          totalSubmissions: 8,
          currentRoundSubmissions: 6,
          totalWarnings: 7,
          teamsWithActuals: 0,
          scoredSubmissions: 0,
          oneWarningTeams: 3,
          twoWarningTeams: 2,
        },
        submissionProgress: {
          submitted: 6,
          pending: 2,
          total: 8,
        },
      }),
      NOW
    )

    expect(display.primaryRiskText).toContain('2 teams still need to submit')
    expect(display.primaryAction.title).toBe('Send reminders')
  })

  it('keeps teams-at-risk separate from disqualified counts', () => {
    const display = buildCommandCenterDisplay(
      makeDashboardData({
        stats: {
          totalTeams: 8,
          activeTeams: 8,
          disqualifiedTeams: 9,
          totalUsers: 30,
          totalSubmissions: 8,
          currentRoundSubmissions: 8,
          totalWarnings: 5,
          teamsWithActuals: 0,
          scoredSubmissions: 0,
          oneWarningTeams: 2,
          twoWarningTeams: 1,
        },
        submissionProgress: {
          submitted: 8,
          pending: 0,
          total: 8,
        },
      }),
      NOW
    )

    expect(display.teamsAtRisk).toBe(3)
    expect(display.kpis.find((kpi) => kpi.id === 'teams-at-risk')?.value).toBe('3')
  })
})
