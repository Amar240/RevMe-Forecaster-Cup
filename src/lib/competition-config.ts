/**
 * Single source of truth for the competition's structural constants. These were previously
 * hard-coded across the dashboard, submit page, and rules copy (e.g. "12 predictions",
 * "3 markets", "of 10 max", "/ 3"), which meant they silently drifted — most visibly the
 * "12 predictions" label being wrong on the final round (which has 1 week, not 2).
 */

/** Metrics predicted per market-week: Occupancy + ADR. */
export const METRICS_PER_WEEK = 2

/** Forecast horizon in weeks for a normal round (Week+1 and Week+2). */
export const WEEKS_PER_ROUND = 2

/** The final round forecasts a single week only. */
export const WEEKS_PER_FINAL_ROUND = 1

/** A season must have exactly this many active markets before submissions open. */
export const REQUIRED_ACTIVE_MARKETS = 3

/** Maximum teams a single supervisor may own. */
export const MAX_TEAMS_PER_SUPERVISOR = 10

/** A team is disqualified once it reaches this many missed-submission warnings. */
export const WARNING_DISQUALIFICATION_THRESHOLD = 3

/** Weeks forecasted for a round, accounting for the shorter final round. */
export function weeksForRound(isFinal: boolean): number {
  return isFinal ? WEEKS_PER_FINAL_ROUND : WEEKS_PER_ROUND
}

/** Total prediction values a team must enter for a round: markets × weeks × metrics. */
export function predictionsRequired(marketCount: number, isFinal: boolean): number {
  return marketCount * weeksForRound(isFinal) * METRICS_PER_WEEK
}

/** Human-readable breakdown, e.g. "12 predictions (3 markets × 2 weeks × 2 metrics)". */
export function predictionsBreakdownLabel(marketCount: number, isFinal: boolean): string {
  const weeks = weeksForRound(isFinal)
  const total = predictionsRequired(marketCount, isFinal)
  const marketWord = marketCount === 1 ? 'market' : 'markets'
  const weekWord = weeks === 1 ? 'week' : 'weeks'
  return `${total} predictions (${marketCount} ${marketWord} × ${weeks} ${weekWord} × ${METRICS_PER_WEEK} metrics)`
}
