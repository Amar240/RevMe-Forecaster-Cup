import type { DashboardData, RoundEntry } from './command-center-types'

export type DisplayTone = 'neutral' | 'info' | 'success' | 'warning' | 'error'
export type DisplayActionKind = 'href' | 'endpoint'
export type DisplayActionIcon =
  | 'send'
  | 'submissions'
  | 'actuals'
  | 'scoring'
  | 'leaderboard'
  | 'approvals'
  | 'risk'

export interface DisplayAction {
  id: string
  title: string
  description: string
  tone: DisplayTone
  icon: DisplayActionIcon
  kind: DisplayActionKind
  href?: string
  endpoint?: string
  actionKey?: string
}

export interface DisplayHealthRow {
  id: string
  label: string
  description: string
  tone: DisplayTone
  kind: 'static' | 'link' | 'toggle'
  href?: string
  actionLabel?: string
  field?: 'leaderboardReviewed' | 'participantsNotified'
  checked?: boolean
}

export interface DisplayKpi {
  id: string
  label: string
  value: string
  subtitle: string
  tone: DisplayTone
}

export interface CommandCenterDisplay {
  seasonLabel: string
  seasonStatusLabel: string | null
  roundLabel: string
  roundBadge: { label: string; tone: DisplayTone }
  deadlineLabel: string
  countdownLabel: string | null
  submissionSummary: string
  submissionPercent: number
  primaryRiskText: string
  primaryRiskTone: DisplayTone
  scoringStatus: string
  primaryAction: DisplayAction
  secondaryAction: DisplayAction | null
  actions: DisplayAction[]
  healthRows: DisplayHealthRow[]
  kpis: DisplayKpi[]
  currentRoundEntry: RoundEntry | null
  latestClosedRound: RoundEntry | null
  nextUpcomingRound: RoundEntry | null
  teamsAtRisk: number
}

function formatStatusLabel(status?: string | null) {
  if (!status) return null
  return status.charAt(0) + status.slice(1).toLowerCase()
}

export function formatEtDateTime(value?: string | null) {
  if (!value) return 'Not scheduled'
  return `${new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))} ET`
}

export function formatCountdownLabel(value: string, now = new Date()) {
  const diffMs = new Date(value).getTime() - now.getTime()
  if (diffMs <= 0) return null

  const totalMinutes = Math.floor(diffMs / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h until start`
  return `${hours}h ${minutes}m remaining`
}

function getCurrentRoundEntry(data: DashboardData) {
  return data.currentRound
    ? data.rounds.find((round) => round.id === data.currentRound?.id) ?? null
    : null
}

function getNextUpcomingRound(data: DashboardData, now: Date) {
  return data.rounds.find((round) => new Date(round.opensAt).getTime() > now.getTime()) ?? null
}

function getLatestClosedRound(data: DashboardData, now: Date) {
  return [...data.rounds]
    .reverse()
    .find((round) => new Date(round.closesAt).getTime() <= now.getTime()) ?? null
}

function getScoringStatus(
  data: DashboardData,
  currentRoundEntry: RoundEntry | null,
  latestClosedRound: RoundEntry | null
) {
  if (!data.activeSeason) return 'Idle'
  if (currentRoundEntry?.isScored || latestClosedRound?.isScored) return 'Scored'
  if (latestClosedRound?.hasActuals) return 'Ready'
  if (data.currentRound) return 'Collecting'
  if (latestClosedRound && !latestClosedRound.hasActuals) return 'Awaiting Actuals'
  return 'Idle'
}

function getPrimaryAction(args: {
  data: DashboardData
  now: Date
  currentRoundEntry: RoundEntry | null
  latestClosedRound: RoundEntry | null
}): DisplayAction {
  const { data, now, latestClosedRound } = args

  if (data.currentRound && data.submissionProgress.pending > 0) {
    return {
      id: 'send-reminders',
      title: 'Send reminders',
      description: `${data.submissionProgress.pending} teams still need to submit this round`,
      tone: 'warning',
      icon: 'send',
      kind: 'endpoint',
      endpoint: '/api/admin/notifications/round-reminder',
      actionKey: 'reminder',
    }
  }

  if (data.currentRound && new Date(data.currentRound.closesAt).getTime() <= now.getTime()) {
    return {
      id: 'process-missed',
      title: 'Process missed submissions',
      description: 'Deadline passed. Issue warnings for teams that missed the round.',
      tone: 'error',
      icon: 'send',
      kind: 'endpoint',
      endpoint: '/api/admin/notifications/missed-submissions',
      actionKey: 'missed',
    }
  }

  if (latestClosedRound && !latestClosedRound.hasActuals) {
    return {
      id: 'upload-actuals',
      title: 'Upload actuals',
      description: `Round ${latestClosedRound.number} closed and still needs actuals before scoring.`,
      tone: 'warning',
      icon: 'actuals',
      kind: 'href',
      href: '/admin/actuals',
    }
  }

  if (latestClosedRound?.hasActuals && !latestClosedRound.isScored) {
    return {
      id: 'run-scoring',
      title: 'Run scoring',
      description: `Round ${latestClosedRound.number} actuals are ready. Scoring can run now.`,
      tone: 'success',
      icon: 'scoring',
      kind: 'href',
      href: '/admin/scoring',
    }
  }

  if (latestClosedRound?.isScored || args.currentRoundEntry?.isScored) {
    const roundNumber = latestClosedRound?.number ?? args.currentRoundEntry?.number
    return {
      id: 'view-leaderboard',
      title: 'View leaderboard',
      description: roundNumber ? `Round ${roundNumber} has been scored and is ready for review.` : 'Scoring is complete.',
      tone: 'success',
      icon: 'leaderboard',
      kind: 'href',
      href: '/leaderboards',
    }
  }

  return {
    id: 'view-submissions',
    title: 'View submissions',
    description: data.currentRound
      ? `Inspect submission detail for Round ${data.currentRound.number}.`
      : 'Open the submissions explorer for the latest operational data.',
    tone: 'info',
    icon: 'submissions',
    kind: 'href',
    href: '/admin/submissions',
  }
}

function dedupeActions(actions: Array<DisplayAction | null>) {
  const seen = new Set<string>()
  return actions.filter((action): action is DisplayAction => {
    if (!action || seen.has(action.id)) return false
    seen.add(action.id)
    return true
  })
}

export function buildCommandCenterDisplay(data: DashboardData, now = new Date()): CommandCenterDisplay {
  const currentRoundEntry = getCurrentRoundEntry(data)
  const nextUpcomingRound = getNextUpcomingRound(data, now)
  const latestClosedRound = getLatestClosedRound(data, now)
  const teamsAtRisk = data.stats.oneWarningTeams + data.stats.twoWarningTeams
  const submissionPercent =
    data.submissionProgress.total > 0
      ? Math.round((data.submissionProgress.submitted / data.submissionProgress.total) * 100)
      : 0
  const scoringStatus = getScoringStatus(data, currentRoundEntry, latestClosedRound)

  let roundLabel = 'No active season'
  let roundBadge: CommandCenterDisplay['roundBadge'] = { label: 'Needs setup', tone: 'neutral' }
  let deadlineLabel = 'Activate or resume a season to begin operations.'
  let countdownLabel: string | null = null

  if (data.activeSeason) {
    if (data.currentRound) {
      roundLabel = `Round ${data.currentRound.number}`
      roundBadge = {
        label: data.currentRound.status === 'Closing Soon' ? 'Closing Soon' : 'Open',
        tone: data.currentRound.status === 'Closing Soon' ? 'warning' : 'success',
      }
      deadlineLabel = formatEtDateTime(data.currentRound.closesAt)
      countdownLabel = formatCountdownLabel(data.currentRound.closesAt, now)
    } else if (data.rounds.length === 0) {
      roundLabel = 'No active round'
      roundBadge = { label: 'Needs setup', tone: 'neutral' }
      deadlineLabel = 'Rounds are not configured for this season yet.'
    } else if (nextUpcomingRound) {
      roundLabel = 'No active round'
      roundBadge = { label: 'Upcoming', tone: 'info' }
      deadlineLabel = `Next round opens ${formatEtDateTime(nextUpcomingRound.opensAt)}`
      countdownLabel = formatCountdownLabel(nextUpcomingRound.opensAt, now)
    } else {
      roundLabel = 'No active round'
      roundBadge = { label: 'Closed', tone: 'neutral' }
      deadlineLabel = latestClosedRound
        ? `Most recent deadline was ${formatEtDateTime(latestClosedRound.closesAt)}`
        : 'All rounds are closed.'
    }
  }

  const primaryAction = getPrimaryAction({
    data,
    now,
    currentRoundEntry,
    latestClosedRound,
  })

  const secondaryAction =
    primaryAction.id !== 'view-submissions' && data.currentRound
      ? {
          id: 'secondary-view-submissions',
          title: 'View submissions',
          description: `Inspect submission detail for Round ${data.currentRound.number}.`,
          tone: 'info' as const,
          icon: 'submissions' as const,
          kind: 'href' as const,
          href: '/admin/submissions',
        }
      : (data.meta.pendingTeamApprovals ?? 0) > 0
        ? {
            id: 'secondary-review-teams',
            title: 'Review teams',
            description: `${data.meta.pendingTeamApprovals} team approvals are waiting.`,
            tone: 'warning' as const,
            icon: 'approvals' as const,
            kind: 'href' as const,
            href: '/admin/team-approvals',
          }
        : null

  let primaryRiskText = 'No urgent operational blockers right now.'
  let primaryRiskTone: DisplayTone = 'success'

  if (!data.activeSeason) {
    primaryRiskText = 'No operational season is active. Configure or resume a season to begin live play.'
    primaryRiskTone = 'info'
  } else if (data.rounds.length === 0) {
    primaryRiskText = 'This season still needs rounds before submissions and scoring can begin.'
    primaryRiskTone = 'info'
  } else if (data.currentRound && data.submissionProgress.pending > 0) {
    primaryRiskText = `${data.submissionProgress.pending} teams still need to submit in this round.`
    primaryRiskTone = 'warning'
  } else if (latestClosedRound && !latestClosedRound.hasActuals) {
    primaryRiskText = `Round ${latestClosedRound.number} is blocked on actuals before scoring can proceed.`
    primaryRiskTone = 'warning'
  } else if (latestClosedRound?.hasActuals && !latestClosedRound.isScored) {
    primaryRiskText = `Round ${latestClosedRound.number} is ready for scoring.`
    primaryRiskTone = 'info'
  } else if ((data.meta.pendingTeamApprovals ?? 0) > 0) {
    primaryRiskText = `${data.meta.pendingTeamApprovals} team approvals still need review.`
    primaryRiskTone = 'warning'
  } else if (teamsAtRisk > 0) {
    primaryRiskText = `${teamsAtRisk} teams are currently carrying warning risk.`
    primaryRiskTone = 'warning'
  }

  const actions = dedupeActions([
    primaryAction,
    secondaryAction,
    data.currentRound
      ? {
          id: 'view-submissions',
          title: 'View submissions',
          description: `Inspect submission detail for Round ${data.currentRound.number}.`,
          tone: 'info',
          icon: 'submissions',
          kind: 'href',
          href: '/admin/submissions',
        }
      : null,
    latestClosedRound && !latestClosedRound.hasActuals
      ? {
          id: 'upload-actuals',
          title: 'Upload actuals',
          description: `Round ${latestClosedRound.number} needs actuals before scoring.`,
          tone: 'warning',
          icon: 'actuals',
          kind: 'href',
          href: '/admin/actuals',
        }
      : null,
    latestClosedRound?.hasActuals && !latestClosedRound.isScored
      ? {
          id: 'run-scoring',
          title: 'Run scoring',
          description: `Round ${latestClosedRound.number} is ready to score.`,
          tone: 'success',
          icon: 'scoring',
          kind: 'href',
          href: '/admin/scoring',
        }
      : null,
    (data.meta.pendingTeamApprovals ?? 0) > 0
      ? {
          id: 'review-teams',
          title: 'Review team approvals',
          description: `${data.meta.pendingTeamApprovals} teams are waiting for review.`,
          tone: 'warning',
          icon: 'approvals',
          kind: 'href',
          href: '/admin/team-approvals',
        }
      : null,
    teamsAtRisk > 0
      ? {
          id: 'view-risk',
          title: 'View at-risk teams',
          description: `${teamsAtRisk} teams are carrying 1-2 warnings.`,
          tone: 'warning',
          icon: 'risk',
          kind: 'href',
          href: '/admin/teams?risk=at-risk',
        }
      : null,
  ]).slice(0, 5)

  const healthRows: DisplayHealthRow[] = [
    data.currentRound
      ? {
          id: 'submission-coverage',
          label: 'Submission coverage',
          description:
            data.submissionProgress.pending > 0
              ? `${data.submissionProgress.submitted} of ${data.submissionProgress.total} active teams have submitted this round.`
              : `All ${data.submissionProgress.total} active teams have submitted this round.`,
          tone: data.submissionProgress.pending > 0 ? 'warning' : 'success',
          kind: data.submissionProgress.pending > 0 ? 'link' : 'static',
          href: data.submissionProgress.pending > 0 ? '/admin/submissions' : undefined,
          actionLabel: data.submissionProgress.pending > 0 ? 'View submissions' : undefined,
        }
      : {
          id: 'submission-coverage',
          label: 'Submission coverage',
          description: nextUpcomingRound
            ? `No active round yet. Round ${nextUpcomingRound.number} opens ${formatEtDateTime(nextUpcomingRound.opensAt)}.`
            : 'No round is currently collecting submissions.',
          tone: 'neutral',
          kind: 'static',
        },
    latestClosedRound && !latestClosedRound.hasActuals
      ? {
          id: 'scoring-readiness',
          label: 'Scoring readiness',
          description: `Round ${latestClosedRound.number} is waiting on actuals before scoring can start.`,
          tone: 'warning',
          kind: 'link',
          href: '/admin/actuals',
          actionLabel: 'Upload actuals',
        }
      : latestClosedRound?.hasActuals && !latestClosedRound.isScored
        ? {
            id: 'scoring-readiness',
            label: 'Scoring readiness',
            description: `Round ${latestClosedRound.number} actuals are uploaded and ready for scoring.`,
            tone: 'success',
            kind: 'link',
            href: '/admin/scoring',
            actionLabel: 'Run scoring',
          }
        : latestClosedRound?.isScored
          ? {
              id: 'scoring-readiness',
              label: 'Scoring readiness',
              description: `Round ${latestClosedRound.number} has been scored.`,
              tone: 'success',
              kind: 'static',
            }
          : {
              id: 'scoring-readiness',
              label: 'Scoring readiness',
              description: data.currentRound
                ? `Round ${data.currentRound.number} is still collecting submissions.`
                : 'Scoring will unlock after a round closes.',
              tone: data.currentRound ? 'info' : 'neutral',
              kind: 'static',
            },
    {
      id: 'team-approvals',
      label: 'Team approvals',
      description:
        (data.meta.pendingTeamApprovals ?? 0) > 0
          ? `${data.meta.pendingTeamApprovals} team approvals are waiting for review.`
          : 'No pending team approvals.',
      tone: (data.meta.pendingTeamApprovals ?? 0) > 0 ? 'warning' : 'success',
      kind: (data.meta.pendingTeamApprovals ?? 0) > 0 ? 'link' : 'static',
      href: (data.meta.pendingTeamApprovals ?? 0) > 0 ? '/admin/team-approvals' : undefined,
      actionLabel: (data.meta.pendingTeamApprovals ?? 0) > 0 ? 'Review teams' : undefined,
    },
    {
      id: 'teams-at-risk',
      label: 'Teams at risk',
      description:
        teamsAtRisk > 0
          ? `${teamsAtRisk} teams currently have 1-2 warnings.`
          : 'No teams are currently at warning risk.',
      tone: teamsAtRisk > 0 ? 'warning' : 'success',
      kind: teamsAtRisk > 0 ? 'link' : 'static',
      href: teamsAtRisk > 0 ? '/admin/teams?risk=at-risk' : undefined,
      actionLabel: teamsAtRisk > 0 ? 'View teams' : undefined,
    },
    ...(data.currentRound
      ? [
          {
            id: 'leaderboard-reviewed',
            label: 'Leaderboard review',
            description: data.currentRound.leaderboardReviewed
              ? `Round ${data.currentRound.number} leaderboard review is recorded.`
              : `Round ${data.currentRound.number} leaderboard still needs review.`,
            tone: (data.currentRound.leaderboardReviewed ? 'success' : 'warning') as DisplayTone,
            kind: 'toggle' as const,
            field: 'leaderboardReviewed' as const,
            actionLabel: data.currentRound.leaderboardReviewed ? 'Undo' : 'Mark reviewed',
            checked: data.currentRound.leaderboardReviewed,
          },
          {
            id: 'participants-notified',
            label: 'Participants notified',
            description: data.currentRound.participantsNotified
              ? `Round ${data.currentRound.number} participant notice is recorded.`
              : `Round ${data.currentRound.number} participants still need notification.`,
            tone: (data.currentRound.participantsNotified ? 'success' : 'warning') as DisplayTone,
            kind: 'toggle' as const,
            field: 'participantsNotified' as const,
            actionLabel: data.currentRound.participantsNotified ? 'Undo' : 'Mark notified',
            checked: data.currentRound.participantsNotified,
          },
        ]
      : []),
  ]

  const scoringSubtitle = latestClosedRound
    ? `Round ${latestClosedRound.number}`
    : data.currentRound
      ? `Round ${data.currentRound.number}`
      : nextUpcomingRound
        ? `Next: Round ${nextUpcomingRound.number}`
        : 'No round in progress'

  const scoringTone: DisplayTone =
    scoringStatus === 'Scored'
      ? 'success'
      : scoringStatus === 'Ready'
        ? 'success'
        : scoringStatus === 'Awaiting Actuals'
          ? 'warning'
          : scoringStatus === 'Collecting'
            ? 'info'
            : 'neutral'

  const kpis: DisplayKpi[] = [
    {
      id: 'active-teams',
      label: 'Active Teams',
      value: String(data.stats.activeTeams),
      subtitle: data.activeSeason ? `${data.activeSeason.name}` : 'No operational season',
      tone: 'info',
    },
    {
      id: 'submitted-this-round',
      label: 'Submitted This Round',
      value: String(data.submissionProgress.submitted),
      subtitle: `of ${data.submissionProgress.total} teams`,
      tone: data.submissionProgress.pending > 0 ? 'warning' : 'success',
    },
    {
      id: 'teams-at-risk',
      label: 'Teams At Risk',
      value: String(teamsAtRisk),
      subtitle: '1-2 warnings',
      tone: teamsAtRisk > 0 ? 'warning' : 'success',
    },
    {
      id: 'scoring-status',
      label: 'Scoring Status',
      value: scoringStatus,
      subtitle: scoringSubtitle,
      tone: scoringTone,
    },
  ]

  const submissionSummary = !data.activeSeason
    ? 'No operational season is active'
    : data.currentRound
      ? `${data.submissionProgress.submitted} of ${data.submissionProgress.total} active teams submitted`
      : nextUpcomingRound
        ? 'No round is collecting submissions yet'
        : latestClosedRound
          ? `Round ${latestClosedRound.number} submission window has closed`
          : 'No round is currently collecting submissions'

  return {
    seasonLabel: data.activeSeason?.name ?? 'No active season',
    seasonStatusLabel: formatStatusLabel(data.activeSeason?.status),
    roundLabel,
    roundBadge,
    deadlineLabel,
    countdownLabel,
    submissionSummary,
    submissionPercent,
    primaryRiskText,
    primaryRiskTone,
    scoringStatus,
    primaryAction,
    secondaryAction,
    actions,
    healthRows,
    kpis,
    currentRoundEntry,
    latestClosedRound,
    nextUpcomingRound,
    teamsAtRisk,
  }
}
