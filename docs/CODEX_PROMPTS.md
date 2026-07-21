# RevME Forecaster Cup — Codex Implementation Playbook

**How to use this file**
1. Run ONE phase per Codex session, in order. Phases are sequenced so correctness fixes land before features build on them.
2. Paste the **Context Preamble** at the top of every session, then the phase prompt.
3. After each phase: `npm run typecheck && npm run test`, review the diff, commit with the suggested message. Do not start the next phase on a red build.
4. Phases 0–1 are safe for the live season. Phases 2+ ship dark (behind completed rounds) so you can deploy mid-season.

---

## Context Preamble (paste at the top of EVERY Codex session)

```
You are working on RevME Forecaster Cup: a Next.js 14 (App Router) + TypeScript + Prisma + PostgreSQL
platform for an international student hotel-revenue forecasting competition (real stakeholder: a professor
running it with live students — production quality is mandatory).

Repo conventions you MUST follow:
- API routes live in src/app/api/**/route.ts and use helpers from src/server/http.ts:
  requireUser / requireAdmin / requireUserOrResponse / requireAdminOrResponse, parseJson with zod,
  jsonOk / jsonError, ApiError. Never use raw NextResponse.json for errors.
- Domain logic lives in src/server/* and src/lib/* (src/server/*.ts files are often re-exports of src/lib).
- Client data access goes through src/features/<domain>/api.ts using csrfFetch from src/lib/csrf.ts. Never raw fetch.
- All styling uses the CSS-variable design tokens (globals.css) via Tailwind semantic classes
  (bg-surface, text-text-secondary, border-border, bg-primary-soft, text-accent, etc.).
  NEVER hardcode hex colors or tailwind gray-* classes in components.
- UI primitives are in src/components/ui (shadcn-style). Reuse Card, Button, Badge, AlertBanner,
  ConfirmDialog, skeletons. Icons: lucide-react. Toasts: sonner. Charts: recharts.
- Roles: STUDENT, SUPERVISOR, SUB_ADMIN (permission-gated), ADMIN. Sub-admin checks go through
  canPerformAdminAction(user, 'permission:name').
- Scoring domain: Submission→SubmissionValue (OCCUPANCY|ADR × weekOffset 1|2 × 3 markets),
  Actual, PredictionError (absError, apeError), ScoreAggregate (MAPE, scopeType SEASON|ROUND|MARKET_ROUND),
  ScoringRun audit trail. Rounds: 7 per season, final round has weekOffset 1 only. Lower MAPE = better.
- Season scoping: always scope team/member queries with helpers in src/server/team-membership.ts.
- Tests: vitest, in src/test/. Every phase must add/update tests and keep the suite green.
- Audit sensitive admin actions with logAuditAction from src/lib/audit.ts.

General rules: small focused diffs, no new dependencies unless stated, no schema changes unless the
phase says so, preserve all existing behavior not explicitly changed, and run
`npm run typecheck && npm run test` before declaring done.
```

---

## PHASE 0 — Correctness & Safety Fixes (do this first)

```
Fix the following correctness and safety issues. No UI changes in this phase.

1. ROUND-SCOPED SCORING CORRUPTS SEASON AGGREGATES (critical)
   In src/lib/scoring.ts, computeAggregates() fetches PredictionErrors filtered by roundId when
   scope === 'ROUND', but still upserts ScoreAggregate rows with scopeType 'SEASON' from that
   round-filtered set — overwriting the true season MAPE with a single round's MAPE.
   Fix: SEASON-scope aggregates must ALWAYS be computed from ALL of the season's prediction errors,
   regardless of run scope. Round-scope runs should recompute: that round's ROUND aggregates AND the
   full-season SEASON aggregates (from the complete error set). Add a regression test in
   src/test/scoring.test.ts: seed 2 rounds of errors, run round-scoped scoring on round 2, assert the
   SEASON aggregate equals the MAPE across both rounds.

2. SUBMISSION CREATION IS NOT ATOMIC (critical)
   In src/app/api/submissions/route.ts, submission.create and submissionValue.createMany run outside
   a transaction. A failure leaves an orphaned locked submission that blocks resubmission (409).
   Fix: wrap creation of the Submission and its SubmissionValues in prisma.$transaction.
   Also move the two sendSubmissionReceiptEmail calls to AFTER the response-critical work, fire them
   without blocking the 201 response (fire-and-forget with .catch logging + emailSentAt update inside
   the async continuation). Add a test asserting no Submission row exists if value creation throws.

3. CRON ENDPOINT FAILS OPEN
   src/app/api/cron/process-rounds/route.ts allows unauthenticated access when CRON_SECRET is unset.
   Fix: if CRON_SECRET is not configured, return 503 with a logged error. Update .env.example.

4. SCORING PERFORMANCE + ATOMICITY
   runScoring upserts PredictionErrors one-by-one in a loop (hundreds of sequential round trips) and
   partial failure leaves mixed state. Refactor: compute all error rows in memory, then write them in
   batches inside a single prisma.$transaction along with the aggregate upserts (keep the ScoringRun
   status updates outside the transaction so FAILED status can always be recorded). Preserve the
   existing zero-actual MAPE-exclusion warnings behavior exactly. Keep ScoreAggregate upsert semantics.
   Also REMOVE the side effect where runScoring sets isLockedActuals/lockedAt on rounds — move that
   into the admin scoring run route explicitly after a successful run, so locking is a visible,
   auditable step. Update affected tests.

5. TIMEZONE-SAFE ROUND BOUNDARIES
   createSeason in src/server/season.ts builds opensAt/closesAt with server-local new Date(y,m,d).
   The product promise is Eastern Time deadlines. Use date-fns-tz (already a dependency) with
   zonedTimeToUtc('yyyy-MM-dd 00:00:00', 'America/New_York') style construction so round boundaries
   are exact ET midnights/23:59:59.999 regardless of server TZ. Add a unit test that boundaries are
   correct when TZ=UTC.

6. SESSION TOKEN HARDENING (small)
   In src/lib/auth.ts, store a SHA-256 hash of the session token in the DB instead of the raw token
   (hash on create, hash the cookie value on lookup). No schema change needed (same column).
   Note: this invalidates existing sessions on deploy — acceptable.

Commit message: "fix: scoring aggregate scope bug, atomic submissions, cron auth, ET round boundaries, scoring batching"
```

---

## PHASE 1 — Quick UX Wins (safe mid-season)

```
Implement these small, high-visibility UX improvements. Follow the design-token rules strictly.

1. MAPE EXPLAINERS EVERYWHERE
   Create src/components/ui/tooltip.tsx (Radix @radix-ui/react-tooltip — this dependency IS approved)
   and a small <MetricHint term="MAPE" /> component with a glossary map in src/lib/glossary.ts
   covering: MAPE ("Average % miss across all predictions — lower is better", with 1-line formula),
   ADR, Occupancy, RevPAR, Comp Set, Week +1/+2 horizon. Attach hints wherever MAPE/ADR/Occupancy
   column headers or labels appear: leaderboards page, scores page, scoring-verification page,
   submit page. Add persistent "lower is better" microcopy next to every MAPE column header.

2. RANK CARD ON STUDENT DASHBOARD
   In src/app/(dashboard)/dashboard/page.tsx, add a "Your Standing" card in the stats row for
   students on an ACTIVE team: current combined rank + total teams (from the leaderboard logic —
   extract a small server helper getTeamStanding(seasonId, teamId) in src/server/ that reuses the
   published-rounds visibility rules students already have; show "Scores pending" state when no
   published rounds). Include round-over-round movement (▲2 / ▼1 / –) as text+icon, never color alone.

3. FIX MEANINGLESS AVERAGED NUMBERS
   Recent Activity on the student dashboard currently averages occupancy and ADR across all markets.
   Replace with: per-submission chips "3 markets · 12 predictions · Round N" and, when that round has
   published scores, the team's round MAPE.

4. DRAFT AUTOSAVE ON SUBMIT (localStorage)
   In src/app/(dashboard)/submit/page.tsx, autosave the predictions object to localStorage keyed by
   roundId+teamId on every change (debounced 500ms), restore on mount if the round is still open,
   clear on successful submission. Show "Draft saved" microcopy — small muted text with a check icon.
   (Server-side drafts come later; do not add schema.)

5. SOFT SANITY CHECKS ON SUBMIT
   Before the review step, compare each entry against the most recent non-voided Actual for that
   market+metric (fetch once via a new GET /api/submissions/context endpoint returning last actuals
   per market/metric for the season — requireUser, season-scoped). If deviation > 30%, show a
   non-blocking inline warning "This is X% above/below the last observed actual — double-check?".
   Never block submission. Test the endpoint's auth + shape.

6. DUAL TIMEZONE DEADLINES
   Everywhere a deadline renders (dashboard hero, submit page, countdown areas): show ET plus the
   viewer's local time via Intl.DateTimeFormat().resolvedOptions().timeZone when it differs, e.g.
   "Sun, Mar 22, 11:59 PM ET · Mon 8:59 AM GST (your time)".

7. NUMBER TYPOGRAPHY + TREND CUES
   Add a `tabular-nums` utility usage (font-variant-numeric) to all score/rank/countdown numerals.
   Everywhere a green/red trend appears (sparklines on leaderboard, trend chart deltas), pair it with
   ▲/▼ + text and use the --success/--error tokens instead of hardcoded #16a34a/#dc2626.
   Also replace bg-gray-* skeleton classes on the scores page with bg-muted tokens.

Commit message: "feat: glossary tooltips, dashboard standing card, draft autosave, sanity checks, dual-TZ deadlines, numeric polish"
```

---

## PHASE 2 — The Round Debrief (flagship learning feature)

```
Build the Round Debrief: an auto-generated post-round learning page for each team.
Everything is computed from existing tables (PredictionError, Actual, ScoreAggregate,
MarketRoundUpdate, Round, SeasonMarket). Schema change: NONE.

ROUTE & ACCESS
- Page: src/app/(dashboard)/debrief/[roundId]/page.tsx (student + supervisor + admin).
- Students: only for rounds where leaderboardVisible === true AND their team has a submission;
  otherwise a friendly "Debrief unlocks when Round N scores are published" state.
- Supervisors: pick any of their teams (team switcher); admins: any team via ?teamId=.
- API: GET /api/debrief/[roundId]?teamId= — requireUser, enforce the visibility rules above,
  jsonOk/jsonError, season-scoped via team-membership helpers.

API PAYLOAD (compute server-side in src/server/debrief.ts, fully unit-tested):
{
  round: { number, isFinal },
  teamSummary: { roundMape, previousRoundMape, rankNow, rankBefore, totalTeams, percentile,
                 cohortMedianMape },
  markets: [ per market+metric+week: { marketName, metric, weekOffset, predicted, actual,
             absError, apeError, direction: 'OVER'|'UNDER'|'EXACT',
             cohortMedianApe } ],
  highlights: { biggestMiss: <worst apeError entry>, bestCall: <best apeError entry> },
  marketUpdates: [ MarketRoundUpdate rows for this season+round number: { marketName, headline, whatChanged } ],
  patterns: [ bias findings, see below ]
}

BIAS / PATTERN DETECTION (pure functions in src/server/debrief.ts, rule-based, tested):
- Directional bias: for each market+metric, if the team over- (or under-) forecast in >= 3
  consecutive scored rounds, emit { type: 'DIRECTIONAL_BIAS', marketName, metric, direction,
  streak, avgApe } with a plain-language message template:
  "You've over-forecast {market} {metric} {streak} rounds running (avg +{avgApe}%). Consider
  anchoring on the trailing actuals before adjusting for events."
- Horizon gap: if season-to-date week+2 MAPE > 1.5× week+1 MAPE, emit HORIZON_GAP with message
  about uncertainty growing with horizon.
- Improvement: if roundMape improved 3 consecutive rounds, emit IMPROVING_STREAK (celebrate).
Cohort median = median across all ACTIVE/APPROVED teams' round aggregates; never expose other
teams' individual numbers to students.

UI (match existing card language, use design tokens):
- Header: "Round N Debrief · {teamName}", big round MAPE (serif display font, tabular-nums),
  rank movement chip (▲/▼ + text), "beat X% of teams" line.
- Grid of market cards: You vs Actual, delta sentence ("Under by 4.3%"), best/worst flagged with
  accent border. Metric + week clearly labeled with glossary hints from Phase 1.
- "What moved the market" card per market pulling marketUpdates (accent left border), linking to
  /market-info.
- "Pattern watch" cards from patterns[] (primary left border; IMPROVING_STREAK uses success tokens).
- Empty/edge states: no submission that round ("You didn't submit — here's what the market did"),
  first round (no previous comparisons).

WIRING
- Notification on publish: where the admin publishes a round leaderboard (leaderboardVisible flip),
  create Notifications for team members: type 'DEBRIEF_READY', link '/debrief/{roundId}'.
- Student dashboard: after a round is published, show a "Round N debrief ready" card linking to it.
- Sidebar: add "Debriefs" item for students (icon: BookOpen or GraduationCap) listing published
  rounds at /debrief (index page listing rounds with their MAPE + link).
- Tests: server calc unit tests (bias rules, percentile, median), API auth/visibility tests,
  and a rendering smoke test.

Commit message: "feat: round debrief — per-market forecast vs actual, cohort percentile, market updates, bias detection"
```

---

## PHASE 3 — Forecast Workspace (submit redesign)

```
Upgrade /submit into a split "forecast workspace": inputs left, evidence right. Keep the existing
review→confirm→lock flow and all gating logic exactly as-is.

1. EVIDENCE API
   Extend GET /api/submissions/context (from Phase 1) to return, per active market:
   - trailing actuals: last 6 non-voided Actuals per metric (round number + value), season-scoped
   - teamLastRound: the team's most recent scored PredictionError summary for that market
     ({ metric, direction, apeError }) if any
   - marketBrief: MarketInfo summary + up to 3 quickInsights + top 3 resourceLinks
   - latestRoundUpdate: most recent MarketRoundUpdate headline for that market
   requireUser; students must be on a team in the season. Unit-test shape + auth.

2. LAYOUT
   Two-column on lg+ (forms 60% / evidence 40%), stacked on mobile with evidence in a collapsible
   "Market evidence" section per market. Evidence panel per market card:
   - Occupancy + ADR sparkline of trailing actuals (recharts, tokens for colors, tabular-nums,
     "trailing avg X · last Y" caption)
   - "Your last round here": direction + APE with ▲▼ text (from teamLastRound), or "First forecast
     for this market"
   - Market intel: 2-line summary + "Full market brief →" link to /market-info#<marketId>
   Keep all sanity-check warnings from Phase 1 inline next to the relevant input.

3. PROGRESS + CONFIDENCE
   Sticky footer bar: "8 of 12 predictions entered · Draft saved" + Review button (disabled until
   complete, with tooltip listing what's missing). On successful submission show a real completion
   moment: success card "Locked in — good luck, {teamName}" with the submitted grid, next steps
   ("Actuals expected after the round closes; your debrief will appear here"), and a subtle
   framer-motion entrance (framer-motion is already a dependency).

4. Preserve: zod validation, csrfFetch, duplicate/complete-set server checks, review warning card.
   Update/extend submit flow tests.

Commit message: "feat: forecast workspace — evidence panel, progress footer, submission completion state"
```

---

## PHASE 4 — Scores Hub + Insight Layer

```
Merge "My Scores" (/scores) and "Score Details" (/scoring-verification) into one Scores hub at
/scores with tabs: Overview · By Round · By Market · Export. Keep /scoring-verification as a
redirect for students/supervisors (admins keep their verification view unchanged).

OVERVIEW TAB (new — the insight layer, all from existing PredictionError/ScoreAggregate data,
computed in src/server/score-insights.ts with unit tests):
1. Bias meter: per metric, share of predictions over vs under actual season-to-date, rendered as a
   diverging bar with a takeaway sentence ("You lean high on ADR: 68% of predictions above actual").
2. Horizon split: week+1 vs week+2 MAPE side-by-side with takeaway ("Your two-week-out error is
   1.8× your one-week error — normal, but watch the gap").
3. Accuracy by market: 3 mini-cards with market MAPE + trend arrow + "strongest/weakest" labels.
4. Trend chart upgrade: add a cohort median line (anonymous, dashed, --chart-7 token) and quartile
   band behind the team's line. Legend + glossary hints. Respect student round-visibility rules.
RULE: every widget ends with one plain-language sentence. No number without a sentence.

BY ROUND tab = existing round expansion cards, plus a "View debrief →" link per published round.
BY MARKET tab = existing market filter view. EXPORT tab = existing CSV + note about what's included.

Sidebar: student items become: Dashboard, Submit Forecast, My Scores, Debriefs, Leaderboards,
Market Info, Guidelines + Help, Support, Settings (Join Team appears only when the student has no
team in the operational season). Update tests.

Commit message: "feat: unified scores hub with bias meter, horizon split, cohort reference band"
```

---

## PHASE 5 — Leaderboard Reframing

```
Improve /leaderboards to motivate the whole distribution, not just the podium. Keep podium + tabs.

1. "Your position" band directly under the podium (students on a team): rank, percentile,
   gap to next rank ("0.4% behind #6"), movement since last published round (▲▼ text+icon),
   team round-MAPE sparkline. Uses existing leaderboard payload; extend it server-side if needed.
2. Refactor the three near-identical podium Card blocks into one PodiumCard component (place, medal
   token colors, entry) — pure refactor, identical visuals.
3. Replace hand-rolled tab buttons with the existing Radix tabs pattern (or a shared component) and
   fix sparkline hardcoded hex → tokens with ▲▼ pairing (if not already done in Phase 1).
4. Pre-publication state: when students would see ranked rows with all values '--', instead show a
   "Scores land after Round N is reviewed" empty state with the round schedule. Never render rank
   numbers without at least one visible score.
5. Mobile: below md, render the table as stacked cards (rank chip, team, university, MAPE, trend).
6. Add "How scoring works" popover near the tabs: MAPE formula, COMBINED = mean of Occupancy and
   ADR MAPE, published-rounds note for students. Reuse glossary.

Commit message: "feat: leaderboard your-position band, mobile cards, pre-publication states, podium refactor"
```

---

## PHASE 6 — Professor Ops: Conduct · Maintain · Expand

```
Goal: make the platform effectively run itself for the professor. Three workstreams.

A. ROUND RUNBOOK (conduct)
1. src/server/round-runbook.ts: getRoundRunbook(seasonId) returning, for the current + next round,
   an ordered checklist with computed status:
   [round opens (auto) → submission reminders → round closes (auto) → upload actuals (X/Y uploaded)
    → run scoring → review leaderboard (leaderboardReviewed) → publish (leaderboardVisible)
    → notify participants (participantsNotified)]. Each item: done/pending/blocked + deep link to
   the right admin page. Unit-test the derivation.
2. Admin Command Center: add a "This Round" runbook card at the top rendering that checklist —
   the professor should know what to do today in one glance.
3. Automated reminders: extend the cron route (process-rounds) to send a reminder email
   (via existing email lib + EmailDispatch dedupe table) to teams WITHOUT a submission when a round
   has <48h and <24h remaining. Template matches existing email styling. Test the dedupe logic.

B. CLASS INSIGHTS + COACHING (conduct, faculty value)
1. Supervisor dashboard upgrade: replace the plain team list with a team health matrix — columns:
   team, members, submitted this round (with hours-left if not), round MAPE, season trend
   (▲▼ text), bias flag (reuse Phase 2 pattern detection), warnings. Icons + text, never color-only.
2. "Class insights" card: for the supervisor's teams + cohort: most-missed market/metric this round
   ("14 of 18 teams over-forecast Hamburg occupancy"), best forecast of the week (team + market,
   celebrate accuracy). Powered by a new GET /api/supervisor/insights (requireUser + SUPERVISOR
   role check, only their teams' details, cohort stats anonymized).
3. Projectable debrief: /supervisor/round-review/[roundId] — a clean, large-type, full-screen page
   (hide sidebar via a minimal layout) showing: round podium, cohort MAPE distribution (histogram),
   most-missed market with the MarketRoundUpdate explanation, best call of the week. Print-friendly.
   This is what the professor projects in class.

C. EXPANSION PACK (expand)
1. Season templating: on /admin/season, "Create from previous season" — pre-fills markets and
   round cadence from the archived/completed season (names + dates shifted). Uses existing
   createSeason; no schema change.
2. Instructor report export: extend /admin/reports with a per-university season report (CSV +
   printable page): teams, participation rate, round-by-round MAPE, final standings — the artifact
   a professor forwards to a colleague at another university.
3. Public season recap page (unauthenticated, no PII beyond team display names + universities):
   /season-recap/[seasonId] for COMPLETED seasons only — final podium, university standings,
   participation stats, "bring this to your university" CTA linking to /request-demo.
   Server-rendered, cached, no student emails or member names ever.

Commit message: "feat: round runbook + reminders, supervisor coaching matrix, class round-review, season templating, public recap"
```

---

## PHASE 7 — Premium Polish Pass

```
A final quality pass. No behavior changes.

1. Motion: subtle framer-motion entrance/stagger on dashboard cards, debrief cards, and leaderboard
   podium (respect prefers-reduced-motion). Animate rank movement chips.
2. Serif display font (font-display) on all dashboard page H1s and hero numerals (round MAPE,
   countdown, rank) to match the landing page brand.
3. Celebration states: personal-best round MAPE and rank-up toasts/cards on dashboard + debrief
   (success tokens, no confetti libraries).
4. Dark mode audit: run through dashboard, submit, scores, leaderboards, debrief in .dark — fix any
   remaining hardcoded colors (grep for '#' and 'gray-' in src/components + src/app/(dashboard)).
5. Accessibility: focus-visible rings on all interactive rows/cards, aria-labels on icon-only
   buttons, table headers with scope, tooltips keyboard-accessible, color-contrast check on
   accent-on-soft combinations.
6. Empty states audit: every list/table gets an icon + one-line explanation + one action, in the
   voice already used ("Leaderboards will appear after scores are calculated.").
7. Mobile: verify submit workspace, scores hub, and leaderboard cards at 375px; fix overflow.

Commit message: "polish: motion, brand typography, celebration states, dark-mode + a11y + mobile audit"
```

---

## PHASE 8 — Supervisor Roster Import (deterministic pipeline + approval gate)

```
Build supervisor-facing Excel roster import on top of the existing src/lib/team-import pipeline
(parser.ts, validate.ts, import.ts — reuse aggressively; do not rewrite what works).
A real sample sheet is committed at src/test/fixtures/registration-vinuni-sample.xlsx — it is the
primary test fixture and the format contract. It contains real-world dirt you MUST handle:
a metadata block above the header row, wide member triplets, a tab character inside an email,
trailing spaces, and a row with two names glued into First Name with an empty Last Name.

1. SCHEMA (one small migration)
   model ImportBatch {
     id, uploaderId (User), role at upload (SUPERVISOR|ADMIN), seasonId, universityId?,
     fileName, fileHash (sha256), s3Key?, status enum IMPORT_BATCH_STATUS
     (PREVIEWED | CONFIRMED | COMPLETED), summaryJson Json, createdAt
   }
   Index on uploaderId and seasonId. Write a standard Prisma migration.

2. PARSER UPGRADES (src/lib/team-import/parser.ts, keep existing formats working)
   - Header-row detection: scan the first 20 rows for the row containing >= 2 consecutive
     First Name / Last Name / Email triplets plus an Institution/TeamID cell; everything above it
     is the metadata block. Do NOT assume the header is row 1.
   - Metadata harvest: extract university name, instructor name, instructor email, declared team
     count from the metadata block when present (label-value pairs in columns B/C).
   - Cell hygiene applied to every cell BEFORE validation: strip \t, \r, non-breaking and
     zero-width spaces, collapse internal whitespace, trim; lowercase emails.
   - Wide-format members: collect ALL First/Last/Email triplets on a team row (submitter =
     "Corresponding Team Member" triplet, rest = additional members). Attach provenance to every
     parsed person: { rowNumber, columnLabel } e.g. "Row 11 · Additional Member 2" — every
     validation message must include it.
   - New warnings (non-blocking): declared team count != parsed team rows; instructor email in
     metadata != uploading supervisor's email; first name contains 2+ capitalized words while
     last name is empty ("possible glued name — check split").

3. RECONCILIATION (extend validate.ts; the four cases must be explicit and tested)
   Per person, by normalized email against User:
   a) no account        -> provision (existing peopleToProvision path)
   b) account, no team in this season -> attach existing user (never modify their name/password)
   c) account, already on another team this season -> row ERROR naming that team (never move)
   d) account, name mismatch -> attach + warning (email wins; keep existing nameMismatch flag)
   Plus intra-file duplicate: same email on 2+ rows/triplets in one upload -> ERROR on both rows
   with both locations. All checks season-scoped via team-membership helpers.

4. SUPERVISOR SCOPING & AUTH
   New endpoints under /api/supervisor/roster-import: preview (multipart upload) and confirm.
   requireUser + SUPERVISOR role. Enforce: teams are created with supervisorId = uploader,
   university = uploader's university (row Institution differing from it = row error),
   SUPERVISOR_TEAM_CAP (10) counting existing season teams + this batch, and season must have
   registrationOpen = true. Admin import at /admin/teams/import keeps its current behavior and
   permissions untouched, except it also records an ImportBatch row.

5. CONFIRM = ONE TRANSACTION + APPROVAL GATE
   In prisma.$transaction: upsert users (provision case a), create teams with status
   PENDING_APPROVAL (supervisor path; admin path stays ACTIVE), create TeamMembers with
   isSubmitter for the corresponding member, upsert by @@unique([seasonId, externalTeamId]) so
   re-confirmation never duplicates, write the ImportBatch (status CONFIRMED, summaryJson = row
   results). After commit: notify all admins ("{University}: N teams awaiting approval — {supervisor}")
   linking to /admin/team-approvals.
   EMAIL TIMING (important): provisioned users get NO email at confirm time on the supervisor
   path. Welcome + password-reset emails are sent when the team is APPROVED (hook into the
   existing approval action; dedupe via EmailDispatch). Rejected teams' students must never
   receive email. Admin-path import keeps its current immediate-email behavior.

6. APPROVAL UX (extend /admin/team-approvals)
   Group pending teams by import batch (university + supervisor + uploaded date), add
   "Approve all in batch" with ConfirmDialog, keep per-team approve/reject with reason.
   On reject: notify the supervisor with the reason. On approve: trigger the deferred emails.
   logAuditAction for batch approve and each reject.

7. SUPERVISOR UI — /supervisor/import (add to supervisor sidebar as "Import Teams")
   Wizard: (1) Upload card with drag-drop + "Download template" button (template .xlsx generated
   server-side from the canonical schema so it never drifts) → (2) Preview: per-team cards or
   table with row status chips (ready / warnings / error), each person labeled
   "will be created" or "existing account — will be added", errors with cell provenance, summary
   header (X teams · Y new accounts · Z existing · N errors) → (3) Confirm with the
   "submitted for admin approval" explanation → (4) Result + batch history list (their past
   ImportBatches with status). Reuse Card/Badge/AlertBanner/ConfirmDialog + tokens; loading,
   empty, and error states required.

8. S3 ARCHIVAL (graceful)
   Store the original upload at imports/{seasonId}/{batchId}/{fileName} reusing the S3 client
   pattern from src/lib/archive.ts; in environments without AWS creds, skip with a logged warning
   (s3Key stays null). Never block the import on S3 failure.

9. TESTS (vitest, use the committed fixture)
   - Parser: header-row detection, metadata harvest, tab-in-email cleaned, trailing spaces,
     glued-name warning fires on the VinUniversity3 row, all 6 teams and every member parsed with
     correct provenance.
   - Reconciliation: seed users to cover cases a–d + intra-file duplicate; assert exact
     error/warning messages include provenance.
   - Confirm: transaction atomicity (failure -> no partial teams), PENDING_APPROVAL status,
     idempotent double-confirm, team cap enforcement, university mismatch rejection.
   - Approval: batch approve activates teams and sends deferred emails exactly once
     (EmailDispatch dedupe), reject notifies supervisor and sends nothing to students.

Commit message: "feat: supervisor roster import — resilient parsing, reconciliation, batch admin approval, deferred emails"
```

---

## PHASE 9 — AI Import Assist (Bedrock, feature-flagged)

```
Add an optional AI assist layer to the roster import. It ONLY produces suggestions rendered in
the preview UI; accepted suggestions re-enter the deterministic validators. It must never write
to the database or auto-apply anything.

1. FLAG + CLIENT
   Enabled only when env BEDROCK_IMPORT_ASSIST=true (document in .env.example; disabled locally).
   New dependency (approved): @aws-sdk/client-bedrock-runtime. Create src/server/import-assist.ts
   with a thin invoke wrapper: model anthropic claude haiku (configurable via
   BEDROCK_IMPORT_MODEL), 10s timeout, one retry, zod-validated JSON output; on any failure
   return null and log — the import flow continues without assistance. Auth: the EC2 instance
   role gets bedrock:InvokeModel for the configured model only (add to DEPLOY_NOTES.md).

2. USE CASE A — LAYOUT/HEADER MAPPING FALLBACK
   When deterministic header detection fails or maps < 80% of expected columns, send ONLY the
   first 10 rows (raw cell grid) and the canonical field list; expect
   { headerRowIndex, columnMap: [{column, field, confidence}] }. Render as a "Suggested mapping"
   panel the supervisor explicitly applies; applied mapping goes through the normal parser path.

3. USE CASE B — ROW REPAIR SUGGESTIONS
   For rows that failed deterministic validation (glued names, malformed emails, missing last
   name), send only those rows' person cells; expect per-field
   { suggestion, reason, confidence }. Render as inline accept/edit chips in the preview
   ("Suggested: Van Truong / Cao — accept?"). Accepted values are re-validated by the same
   zod/validate.ts rules before they count as fixed. Log every suggestion + accept/reject to the
   ImportBatch summaryJson for auditability.

4. GUARDRAILS
   - Endpoints under /api/supervisor/roster-import/assist, requireUser + SUPERVISOR (or admin),
     404 when the flag is off.
   - Never send more rows than needed; never include data beyond the uploaded sheet's own cells.
   - UI clearly labels suggestions as AI-generated; no suggestion is ever pre-applied.
   - Tests: mock the Bedrock client; assert flag-off 404s, malformed model output is discarded,
     accepted suggestions re-run validators (an invalid "fix" is still rejected), and the
     deterministic path is unchanged when assist is unavailable.

Commit message: "feat: optional Bedrock import assist — mapping fallback and row-repair suggestions behind flag"
```

---

## Guardrails for every phase (Codex should self-check before finishing)

- [ ] `npm run typecheck` and `npm run test` pass
- [ ] No hardcoded colors; tokens only. No raw `fetch` in client code; `csrfFetch` only.
- [ ] All new API routes: auth helper + zod + jsonOk/jsonError + season scoping + a test
- [ ] Students can never see another team's individual numbers outside published leaderboards
- [ ] Admin mutations call `logAuditAction`
- [ ] New pages have loading (skeleton) + empty + error states
- [ ] Diff reviewed against unrelated files — no drive-by changes
