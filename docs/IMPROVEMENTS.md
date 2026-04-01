# RevME Forecaster Cup – Improvements Roadmap

This document captures the results of a systematic codebase review and provides a prioritized, actionable roadmap to bring the platform to production quality across backend consistency, frontend UX, test coverage, and AWS deployment readiness.

Companion docs: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`admin-runbook.md`](admin-runbook.md) · [`AWS_MIGRATION.md`](AWS_MIGRATION.md) · [`PRD_RevME_Forecaster_Cup.md`](PRD_RevME_Forecaster_Cup.md)

---

## 1. Current State & Short-Term Priorities

### What works well today

| Area | Strengths |
|------|-----------|
| **Domain model** | Prisma schema is thorough — seasons, rounds, markets, submissions, actuals, scoring, warnings, audit logs, support tickets are all modelled with proper enums, unique constraints, and revision history. |
| **Auth & RBAC** | Session system (`revme_session` cookie), role enum (`STUDENT`/`SUPERVISOR`/`SUB_ADMIN`/`ADMIN`), fine-grained `Permission`/`UserPermission` tables, plus `hasFullAccess` flag for sub-admins. |
| **Middleware** | `src/middleware.ts` enforces origin checks, CSRF token validation, and tiered rate limiting (10/60/120 req/min) centrally — before any route handler runs. |
| **Scoring engine** | `src/lib/scoring.ts` correctly handles per-value AE/APE, actual=0 edge cases, season & round aggregates, auditable `ScoringRun` records, and stale-score flags. |
| **Shared helpers** | `src/lib/http.ts` provides `ApiError`, `jsonOk`/`jsonError`, `parseJson`, `requireUser`/`requireAdmin`, and the `*OrResponse` variants — a solid pattern when routes adopt it. |
| **Feature folders** | 8 feature modules already exist under `src/features/` (actuals, auth, leaderboards, season, submissions, support, teams, users) with `api.ts` and `types.ts` files. |
| **Testing infra** | Vitest setup with DB reset, session mocking, fixtures, and `makeRequest` helper is in place and functional. |

### Near-term goal

> **Run the next competition season reliably with the current feature set** — no new features, just consistency, quality, and operational confidence.

### Risks to address before go-live

1. **50 of 68 API routes** still use manual `try/catch` + `console.error` + raw `NextResponse.json` instead of the shared helpers → inconsistent error shapes, no structured logging, harder to debug.
2. **Zero rate-limit usage inside route handlers** — middleware covers the perimeter, but individual handlers don't apply `rateLimit()` calls. This is acceptable since middleware already handles it, but should be documented.
3. **`next.config.js` ignores ESLint and TypeScript errors during builds** (`ignoreDuringBuilds: true`, `ignoreBuildErrors: true`) — type and lint errors will silently pass through `npm run build`.
4. **~10 test cases** across 5 files — critical paths like auth login/register, teams CRUD, permissions unit tests, and scoring edge cases are uncovered.
5. **Raw HTML form elements** (`<select>`, `<textarea>`, `<input type="radio">`, `<input type="checkbox">`) used on 12+ pages instead of the shared `shadcn/ui` components → inconsistent styling, no dark-mode readiness, accessibility gaps.
6. **`alert()` used for errors** on Admin Users and Admin Teams pages instead of toast/inline UI.
7. **No shared `Textarea` component** exists in `src/components/ui/` — every textarea is a raw `<textarea>`.

---

## 2. API Route Normalization Plan

### Current state

| Category | Count | Pattern |
|----------|-------|---------|
| **Shared helpers** (`@/server/http` → `@/lib/http`) | 18 | Uses `requireUserOrResponse` / `requireAdminOrResponse`, `jsonOk`, `jsonError`, `parseJson` |
| **Manual pattern** | 50 | Calls `getSession()` directly, manual `try/catch`, `console.error`, raw `NextResponse.json` |

### Routes using shared helpers (18) — no changes needed

| Route | Notes |
|-------|-------|
| `api/submissions/route.ts` | ✅ |
| `api/support-tickets/route.ts` | ✅ |
| `api/support-tickets/[id]/route.ts` | ✅ |
| `api/support-tickets/auto-escalate/route.ts` | ✅ |
| `api/submissions/current/route.ts` | ✅ |
| `api/submissions/history/route.ts` | ✅ |
| `api/scores/trends/route.ts` | ✅ |
| `api/leaderboards/route.ts` | ✅ |
| `api/request-demo/route.ts` | ✅ |
| `api/admin/demo-requests/route.ts` | ✅ |
| `api/admin/actuals/route.ts` | ✅ |
| `api/admin/actuals/[id]/route.ts` | ✅ |
| `api/admin/actuals/[id]/unvoid/route.ts` | ✅ |
| `api/admin/actuals/summary/route.ts` | ✅ |
| `api/admin/audit-logs/route.ts` | ✅ |
| `api/admin/audit-logs/export/route.ts` | ✅ |
| `api/admin/season/activate/route.ts` | ✅ |
| `api/admin/warnings/run/route.ts` | ✅ |

### Routes to migrate (50) — grouped by priority

#### Priority 1: Auth routes (security-critical, high traffic)

These routes have deliberate custom logic (e.g., login returns user data, register creates sessions), so the migration is about adopting `jsonOk`/`jsonError`/`parseJson` for consistent error shapes — **not** wrapping in `requireUser` (since they serve unauthenticated users).

| Route | Current pattern | Migration notes |
|-------|----------------|-----------------|
| `api/auth/login` | Manual `try/catch`, `console.error` | Use `parseJson(req, loginSchema)` for body parsing, `jsonOk()` for success, `jsonError()` for catch. Keep custom 401 for invalid credentials via `ApiError`. |
| `api/auth/register` | Manual `try/catch`, `console.error` | Same approach. Replace `z.ZodError` check in catch with `jsonError(error)` which already handles `ZodError`. |
| `api/auth/logout` | Manual `try/catch` | Minimal — add `jsonOk`/`jsonError`. |
| `api/auth/forgot-password` | Manual `try/catch`, `console.error` | Use `parseJson`, `jsonOk`, `jsonError`. |
| `api/auth/reset-password` | Manual `try/catch`, `console.error` | Use `parseJson`, `jsonOk`, `jsonError`. |
| `api/auth/me` | Manual `getSession()` check | Replace with `requireUserOrResponse`, `jsonOk`. |
| `api/auth/permissions` | Manual `getSession()` check | Replace with `requireUserOrResponse`, `jsonOk`. |

#### Priority 2: Team & user routes (core workflow)

| Route | Migration notes |
|-------|-----------------|
| `api/teams/route.ts` (GET+POST) | Replace `getSession()` + manual 401 with `requireUserOrResponse`. Replace role checks with `requireUser` + role guard. Use `parseJson` for POST body. |
| `api/teams/[id]/route.ts` | Same pattern. |
| `api/teams/[id]/members/route.ts` | Same pattern. |
| `api/teams/[id]/members/[memberId]/route.ts` | Same pattern. |
| `api/teams/[id]/submitter/route.ts` | Same pattern. |
| `api/join-requests/route.ts` | Same pattern. |
| `api/supervisor/join-requests/route.ts` | Same pattern. |
| `api/user/supervisor/route.ts` | Same pattern. |
| `api/users/me/route.ts` | Same pattern. |
| `api/users/acknowledge-rules/route.ts` | Same pattern. |

#### Priority 3: Admin routes (50% of remaining manual routes)

| Route | Migration notes |
|-------|-----------------|
| `api/admin/command-center/route.ts` | Replace `getSession()` + manual role check with `requireAdminOrResponse`. |
| `api/admin/season/route.ts` | Already imports `@/lib/permissions` — wrap in `requireAdminOrResponse`. |
| `api/admin/teams/route.ts` | Same pattern. |
| `api/admin/teams/pending/route.ts` | Same pattern. |
| `api/admin/teams/[id]/reinstate/route.ts` | Same pattern. |
| `api/admin/teams/[id]/disqualify/route.ts` | Same pattern. |
| `api/admin/users/route.ts` | Same pattern. |
| `api/admin/users/[id]/role/route.ts` | Same pattern. |
| `api/admin/users/[id]/reset-password/route.ts` | Same pattern. |
| `api/admin/users/[id]/delete/route.ts` | Same pattern. |
| `api/admin/users/[id]/force-logout/route.ts` | Same pattern. |
| `api/admin/submissions/route.ts` | Same pattern. |
| `api/admin/submissions/pending/route.ts` | Same pattern. |
| `api/admin/submissions/export/route.ts` | Same pattern. |
| `api/admin/universities/route.ts` | Same pattern. |
| `api/admin/universities/[id]/route.ts` | Same pattern. |
| `api/admin/sub-admins/route.ts` | Same pattern. |
| `api/admin/sub-admins/[id]/route.ts` | Same pattern. |
| `api/admin/market-info/route.ts` | Same pattern. |
| `api/admin/market-info/links/route.ts` | Same pattern. |
| `api/admin/market-info/round-updates/route.ts` | Same pattern. |
| `api/admin/notifications/missed-submissions/route.ts` | Same pattern. |
| `api/admin/notifications/round-reminder/route.ts` | Same pattern. |
| `api/admin/rounds/[id]/status/route.ts` | Same pattern. |
| `api/admin/rounds/[id]/lock/route.ts` | Same pattern. |
| `api/admin/scoring/run/route.ts` | Same pattern. |
| `api/admin/scoring/status/route.ts` | Same pattern. |

#### Priority 4: Misc routes

| Route | Migration notes |
|-------|-----------------|
| `api/health/route.ts` | Minimal — just return `jsonOk({ status: 'ok' })`. No auth needed. |
| `api/submissions/export/route.ts` | Replace with `requireUserOrResponse`. |
| `api/market-info/route.ts` | Replace with `requireUserOrResponse`. |
| `api/notifications/route.ts` | Replace with `requireUserOrResponse`. |
| `api/canned-responses/route.ts` | Replace with `requireAdminOrResponse`. |
| `api/scoring/verification/route.ts` | Replace with `requireUserOrResponse`. |

### Migration template

Each manual route should be converted from:

```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await getSession()
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }
    // ... business logic ...
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Something error:', error)
    return NextResponse.json({ message: 'Failed' }, { status: 500 })
  }
}
```

To:

```typescript
import { requireUserOrResponse, jsonOk, jsonError } from '@/server/http'

export async function GET() {
  try {
    const { user, response } = await requireUserOrResponse()
    if (response) return response
    // ... business logic ...
    return jsonOk({ data })
  } catch (error) {
    return jsonError(error, 'Failed')
  }
}
```

For admin routes, use `requireAdminOrResponse(permission?)` instead. For routes with POST bodies, use `parseJson(request, schema)` instead of manual `await request.json()` + `schema.parse()`.

### Permissions consistency

Two import paths are currently used for the same function:

- `@/lib/permissions` → used by 3 routes
- `@/server/permissions` → used by 6 routes

`@/server/permissions` re-exports `@/lib/permissions`. **Standardize on `@/server/permissions`** for all route files (server-only code should import from `@/server/*`).

---

## 3. Frontend UX Improvements by Role

### Cross-cutting issues

#### 3.1 Missing shared `Textarea` component

No `Textarea` exists in `src/components/ui/`. Create one following the shadcn/ui pattern:

```typescript
// src/components/ui/textarea.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
```

#### 3.2 Raw `<select>` elements → replace with shared `Select`

**Pages using raw `<select>` (12 pages):**

| Page | Count of raw selects |
|------|---------------------|
| Admin Escalations | 2 |
| Admin Scoring | 1 |
| Scoring Verification | 4 |
| Supervisor Requests | 1 |
| Admin Demo Requests | 1+ |
| Admin Market Info | 1 |
| Admin Actuals | 6+ |
| Student Support | 1 |
| Register (radio buttons) | 1 |
| Admin Sub-Admins (checkboxes) | multiple |

#### 3.3 `alert()` → toast or inline UI

**Pages using `alert()`:**
- `src/app/(dashboard)/admin/users/page.tsx`
- `src/app/(dashboard)/admin/teams/page.tsx`

Replace with a toast notification system (e.g., shadcn/ui `sonner` or `toast`) or inline error banners.

#### 3.4 Loading states inconsistency

| Pattern | Pages using it | Recommendation |
|---------|---------------|----------------|
| **Skeleton** (best) | Admin Users, Admin Teams, Admin Audit Logs, Admin Submissions, Scores | Keep — this is the gold standard |
| **Spinner** (Loader2) | Most client pages | Acceptable, but consider skeleton for data-heavy pages |
| **Text only** ("Loading...") | Settings, Universities, Season, Team Detail, Demo Requests | Upgrade to at minimum a centered spinner, ideally skeleton |
| **None** | Teams list (server), Dashboard (server), Reports (server) | Acceptable for server components if they render fast |

### Student pages

| Page | Issues | Improvements |
|------|--------|-------------|
| **Dashboard** | No error handling on data fetch; `hidden md:flex` for season label hides context on mobile | Add error boundary; show season info on mobile in a compact card |
| **Join Team** | No inline validation; max-w-2xl with no responsive grid | Add validation on team code field; responsive layout |
| **Submit** | Loading state is just animated text; market tabs may overflow on narrow screens | Add skeleton for initial load; horizontal scroll or accordion for markets on mobile |
| **Scores** | Error only logged to console | Show user-facing "Could not load scores" banner with retry |
| **Leaderboards** | Error only logged to console | Same — add user-facing error state |
| **Support** | Raw `<select>` and `<textarea>`; no inline validation | Use shared `Select` and `Textarea`; add required field indicators |
| **Rules** | Error only logged to console | Mostly static — acceptable, but add offline fallback text |
| **Settings** | "Loading..." text only; errors logged only; no responsive tweaks for name grid | Spinner or skeleton; inline error banner; `grid-cols-1 md:grid-cols-2` |
| **Market Info** | Error only logged to console | Add retry/error state |

### Supervisor pages

| Page | Issues | Improvements |
|------|--------|-------------|
| **Dashboard** | No error handling (server component) | Add error boundary in parent layout |
| **Join Requests** | Raw `<select>`; errors logged only | Use shared `Select`; show user-facing error banner |
| **Support Inbox** | Raw `<select>` (2), `<textarea>` (2), `<input type="checkbox">`; errors logged only | Replace with shared components; add error banner |
| **Teams List** | No loading state (server component) | Acceptable — but add empty state if supervisor has 0 teams |
| **Team Detail** | "Loading..." text only | Spinner; responsive layout for member list |
| **Reports** | No loading or error handling | Add basic loading indicator |

### Admin pages

| Page | Issues | Improvements |
|------|--------|-------------|
| **Command Center** | Redirects to `/dashboard` — no standalone content | This is by design (dashboard renders `AdminCommandCenter`). No change needed. |
| **Users** | `alert()` for action errors | Replace with toast/inline notification |
| **Teams** | `alert()` for disqualify/reinstate; CardSkeleton/TableSkeleton ✅ | Replace `alert()` with toast |
| **Season** | "Loading..." text only | Spinner; add confirmation dialog for season activation |
| **Scoring** | Raw `<select>` and `<input type="radio">`; good error/success banners ✅ | Replace form elements with shared components |
| **Actuals** | Raw `<select>` (6+), `<textarea>` (4+), `<input type="checkbox">`; good error/permission handling ✅ | Replace with shared components |
| **Submissions** | TableSkeleton ✅; errors logged only | Add user-facing error banner |
| **Audit Logs** | TableSkeleton ✅; errors logged only | Add user-facing error banner |
| **Universities** | "Loading..." text only; basic empty state ✅ | Upgrade loading state |
| **Sub-Admins** | Raw `<input type="checkbox">` | Replace with shared `Checkbox` from shadcn/ui |
| **Market Info** | Raw `<textarea>` (2), raw `<select>`; `grid-cols-12` may be cramped on tablet | Replace with shared components; test on iPad-width |
| **Escalations** | Raw `<select>` (2), `<textarea>`, `<checkbox>`; no `overflow-x-auto` on tables | Replace with shared components; add table scroll wrapper |
| **Demo Requests** | "Loading..." text; raw `<select>` per request | Upgrade loading; use shared `Select` |
| **Team Approvals** | Loader2 ✅; good empty state ✅ | No major issues |

### Public pages

| Page | Issues | Improvements |
|------|--------|-------------|
| **Landing** | Well-designed with framer-motion ✅ | Minor: ensure all images have alt text and lazy-load |
| **Request Demo** | Raw `<input>`, raw `<textarea>` — does NOT use shared `Input`/`Label` | Rewrite form to use shared `Input`, `Label`, `Textarea` |

### Mobile responsiveness summary

Most pages use `md:` breakpoints for grids. Key gaps:
- **Missing `overflow-x-auto`** on tables: Escalations, Support Inbox
- **Sidebar**: Needs a mobile hamburger/drawer pattern (currently not usable on narrow screens)
- **Admin Actuals**: Complex form layout breaks on tablet widths
- **Market Info (admin)**: `grid-cols-12` with `col-span-3`/`col-span-9` leaves sidebar too narrow on tablet

---

## 4. Test Expansion Plan

### Current coverage

| Test file | What it covers | Cases |
|-----------|---------------|-------|
| `src/test/scoring.test.ts` | Full scoring run (78 prediction errors, MAPE, aggregates, leaderboard) | 1 |
| `src/test/rbac.test.ts` | RBAC: student/supervisor blocked, admin allowed, sub-admin with permission | 4 |
| `src/test/warnings.test.ts` | 3 missed submissions → DQ, blocked submission for DQ'd team | 1 |
| `src/test/round-gating.test.ts` | Reject when round not open, accept when open, lock 409 | 2 |
| `src/lib/rate-limit.test.ts` | Window enforcement, key independence | 2 |

**Total: ~10 test cases across 5 files.**

### Priority 0 — Security & auth (write first)

#### `src/test/auth.test.ts` (new)

| Test case | What it validates |
|-----------|-------------------|
| `hashPassword` produces a bcrypt hash | `verifyPassword(plain, hash)` returns true |
| `verifyPassword` rejects wrong password | Returns false |
| `createSession` inserts a Session row and sets cookie | DB query + mock check |
| `getSession` returns user for valid token | Fixture user |
| `getSession` returns null for expired token | Expired `expiresAt` |
| `getSession` returns null for missing cookie | No `__testAuthToken` |
| `destroySession` removes Session rows | DB count check |

#### `src/test/auth-api.test.ts` (new)

| Test case | What it validates |
|-----------|-------------------|
| POST `/api/auth/login` with valid credentials → 200 + user data | Happy path |
| POST `/api/auth/login` with wrong password → 401 | Error shape |
| POST `/api/auth/login` with non-existent email → 401 | Error shape |
| POST `/api/auth/login` with invalid body → 400 | Zod validation |
| POST `/api/auth/register` with valid data → 201 + session | Happy path |
| POST `/api/auth/register` with duplicate email → 409/422 | Conflict |
| POST `/api/auth/register` with short password → 400 | Validation |
| POST `/api/auth/register` with missing fields → 400 | Validation |

#### `src/test/permissions.test.ts` (new)

| Test case | What it validates |
|-----------|-------------------|
| `hasAdminAccess` returns true for ADMIN | Unit test |
| `hasAdminAccess` returns true for SUB_ADMIN with `hasFullAccess` | Unit test |
| `hasAdminAccess` returns false for SUB_ADMIN without `hasFullAccess` | Unit test |
| `hasAdminAccess` returns false for STUDENT/SUPERVISOR | Unit test |
| `hasAdminAccess` returns false for null | Unit test |
| `canPerformAdminAction` allows ADMIN without permission check | Unit test |
| `canPerformAdminAction` allows SUB_ADMIN with matching permission | DB fixture |
| `canPerformAdminAction` blocks SUB_ADMIN without matching permission | DB fixture |
| `checkPermission` returns true when `UserPermission` exists | DB fixture |
| `checkPermission` returns false when it doesn't | DB fixture |

### Priority 1 — Business logic

#### `src/test/scoring-edge-cases.test.ts` (new)

| Test case | What it validates |
|-----------|-------------------|
| Scoring with `actual = 0` and `predicted = 0` → `apeError = 0` | Edge case |
| Scoring with `actual = 0` and `predicted != 0` → `apeError = null` (excluded) | Edge case |
| Scoring scope = ROUND only scores that round | Scope filter |
| Scoring when no submissions exist → SUCCESS with 0 counts | Empty case |
| Scoring run status = FAILED when DB error occurs | Error handling (mock Prisma) |
| `getExpectedPredictions(7)` returns correct count for final round | Business rule |
| `getTotalExpectedPredictions()` sums across all rounds | Business rule |
| Re-scoring after actuals update produces correct new values | Idempotency |

#### `src/test/teams-api.test.ts` (new)

| Test case | What it validates |
|-----------|-------------------|
| GET `/api/teams` as supervisor → only their teams | Scoping |
| GET `/api/teams` as admin → all teams | Scoping |
| POST `/api/teams` as supervisor → creates team | Happy path |
| POST `/api/teams` with duplicate name → 422 | Business rule |
| POST `/api/teams` when supervisor has 10 teams → 422 | Capacity |
| POST `/api/teams` with no active season → 422 | Precondition |
| POST `/api/teams` as student → 403 | RBAC |

### Priority 2 — Utilities & integrations

#### `src/test/http.test.ts` (new)

| Test case | What it validates |
|-----------|-------------------|
| `jsonOk` returns correct status and body | Unit |
| `jsonError` handles `ApiError` | Unit |
| `jsonError` handles `ZodError` | Unit |
| `jsonError` handles string | Unit |
| `jsonError` handles unknown error | Unit |
| `parseJson` with valid body and schema → parsed data | Unit |
| `parseJson` with invalid JSON → throws `ApiError(INVALID_JSON)` | Unit |
| `parseJson` with invalid shape → throws `ZodError` | Unit |
| `requireUser` when authenticated → returns user | Integration |
| `requireUser` when not authenticated → throws `ApiError(UNAUTHORIZED)` | Integration |
| `requireAdmin` when admin → returns user | Integration |
| `requireAdmin` when student → throws `ApiError(FORBIDDEN)` | Integration |

#### `src/test/email.test.ts` (new — mock nodemailer)

| Test case | What it validates |
|-----------|-------------------|
| `sendPasswordResetEmail` calls `transporter.sendMail` with correct args | Mock |
| `sendWelcomeEmail` calls `transporter.sendMail` | Mock |
| Email functions return false when SMTP not configured | Config guard |

#### `src/test/audit.test.ts` (new)

| Test case | What it validates |
|-----------|-------------------|
| `logAuditAction` creates `AuditLog` row | DB check |
| `logAuditAction` stores before/after JSON correctly | DB check |

### Priority 3 — Additional API routes

| Test file | Routes to cover |
|-----------|----------------|
| `src/test/submissions-api.test.ts` | POST: missing markets, invalid values, non-submitter blocked, DQ'd team blocked |
| `src/test/admin-scoring-api.test.ts` | Permission check, FAILED result handling |
| `src/test/admin-teams-api.test.ts` | Disqualify/reinstate, pending approvals |

### Execution approach

1. Use the existing test infrastructure (`src/test/setup.ts`, `fixtures.ts`, `auth.ts`, `http.ts`, `db.ts`).
2. Follow the established pattern: `describe`/`it`, import route handlers directly, use `makeRequest` and `loginAs`.
3. Run with `npm test` (Vitest).
4. Target: **50+ test cases** covering all P0 and P1 items before the next season.

---

## 5. AWS Deployment Architecture Decision

### Current state

This section is now historical planning context only.

The current deployment source of truth is `docs/AWS_MIGRATION.md`, which standardizes the active staging path as `ALB -> EC2 -> RDS PostgreSQL`.

The notes below reflect an older architecture evaluation and should not be treated as the current deployment recommendation.

### Historical recommendation (superseded): Vercel + RDS PostgreSQL

**Why Vercel + RDS was considered a strong option at the time:**

| Factor | Reasoning |
|--------|-----------|
| **Team size** | Solo developer / small team → minimize operational overhead |
| **Traffic** | Competition runs are seasonal; peak during submission windows; ~50-500 concurrent users. Vercel's serverless model handles this naturally. |
| **Next.js alignment** | Vercel is the canonical deployment target for Next.js App Router. ISR, middleware, and API routes work out of the box with zero config. |
| **Cost** | Vercel Pro ($20/mo) + RDS db.t3.micro ($15-30/mo) + small S3 bucket ≈ **$50-80/month** during a season. |
| **Complexity** | No Dockerfiles, no ECS task definitions, no load balancers, no auto-scaling config. |
| **Migration effort** | Near-zero — just set `DATABASE_URL` and SMTP vars in Vercel env config, run `prisma migrate deploy` in the build step. |

**Historical comparison note: when ECS Fargate seemed more appropriate:**
- If the platform grows to 1000+ concurrent users with real-time features (WebSockets)
- If there are strict data residency requirements (everything must stay in a specific AWS region/VPC)
- If you need background job workers that run for >30 seconds (Vercel serverless functions have a 60s timeout on Pro)

### Architecture diagram

```
┌─────────────────────────────────────────────────┐
│                   Vercel                         │
│                                                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Next.js   │  │ API      │  │ Middleware    │ │
│  │ Pages/SSR │  │ Routes   │  │ (CSRF, Rate  │ │
│  │           │  │          │  │  Limit)       │ │
│  └───────────┘  └────┬─────┘  └──────────────┘ │
│                      │                           │
└──────────────────────┼───────────────────────────┘
                       │
                       │ DATABASE_URL (connection pool)
                       ▼
            ┌─────────────────────┐
            │   AWS RDS           │
            │   PostgreSQL 16     │
            │   (db.t3.micro)     │
            │                     │
            │   - Multi-AZ: off   │
            │     (enable for     │
            │      production)    │
            │   - Backups: daily  │
            │   - Encryption: on  │
            └─────────────────────┘

            ┌─────────────────────┐
            │   AWS S3            │
            │   (revme-exports)   │
            │                     │
            │   - CSV exports     │
            │   - Leaderboard     │
            │     snapshots       │
            └─────────────────────┘

            ┌─────────────────────┐
            │   AWS SES / SMTP    │
            │   (emails)          │
            │                     │
            │   - Password reset  │
            │   - Notifications   │
            └─────────────────────┘
```

### Environment variable mapping

| Variable | Where to set | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | Vercel env vars | RDS endpoint with SSL: `postgresql://user:pass@rds-host:5432/revme?sslmode=require` |
| `NEXT_PUBLIC_APP_URL` | Vercel env vars | `https://revme.yourdomain.com` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Vercel env vars | SES SMTP credentials or another provider |
| `NODE_ENV` | Vercel auto-sets | `production` |

### Deployment pipeline

```
GitHub push to main
       │
       ▼
Vercel auto-deploys:
  1. npm install
  2. npx prisma generate
  3. npx prisma migrate deploy   ← runs migrations against RDS
  4. next build
  5. Deploy to edge
```

### Pre-deploy checklist for Vercel

- [ ] RDS PostgreSQL instance created in same region as Vercel deployment
- [ ] RDS security group allows inbound from Vercel IPs (or use Vercel Secure Compute for VPC peering)
- [ ] `DATABASE_URL` set in Vercel env vars with `?sslmode=require`
- [ ] SMTP credentials configured
- [ ] `NEXT_PUBLIC_APP_URL` set to the production domain
- [ ] Custom domain configured in Vercel
- [ ] Run `npx prisma migrate deploy` once manually against RDS to initialize
- [ ] Enable RDS automated backups (daily, 7-day retention)
- [ ] Set up CloudWatch alarm for RDS CPU > 80% and storage < 20%

### Status of this section

Keep this section only as background on past hosting tradeoff discussions. Do not use it as deployment guidance while `docs/AWS_MIGRATION.md` remains the active AWS reference.

---

## 6. Build Configuration Fix

### Problem

`next.config.js` currently has:

```javascript
eslint: { ignoreDuringBuilds: true },
typescript: { ignoreBuildErrors: true },
```

This means `npm run build` will succeed even if there are type errors or lint violations — silently shipping broken code.

### Recommendation

Remove both flags so that `next build` catches issues:

```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ];
  },
}
```

Before removing the flags, fix any existing type/lint errors by running:
1. `npm run typecheck` — fix all TypeScript errors
2. `npm run lint` — fix all ESLint errors
3. Then remove the `ignoreDuringBuilds` and `ignoreBuildErrors` flags
4. Verify with `npm run build`

---

## 7. Pre-Deploy Quality Checklist

Add this to `README.md` or create `docs/RELEASE.md`:

```markdown
## Pre-Deploy Checklist

Before merging to main or deploying to production:

- [ ] `npm run typecheck` — passes with zero errors
- [ ] `npm run lint` — passes with zero errors
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — builds successfully
- [ ] Manual smoke tests:
  - [ ] Login as student → dashboard loads
  - [ ] Login as supervisor → dashboard loads, can see teams
  - [ ] Login as admin → command center loads
  - [ ] Submit a forecast (if round is open)
  - [ ] Run scoring as admin → status = SUCCESS
  - [ ] View leaderboard — data displays
  - [ ] Create a support ticket → ticket appears
```

---

## 8. Execution Order

| Phase | Focus | Estimated effort | Dependency |
|-------|-------|-----------------|------------|
| **Phase 1** | Create `Textarea` component, fix `alert()` → toast, fix `AWS_MIGRATION.md` MySQL→PostgreSQL | 1-2 hours | None |
| **Phase 2** | Migrate Priority 1 & 2 API routes (auth + teams/users) to shared helpers | 3-4 hours | None |
| **Phase 3** | Write P0 tests (auth, permissions) | 3-4 hours | None |
| **Phase 4** | Migrate Priority 3 API routes (admin) | 3-4 hours | Phase 2 done |
| **Phase 5** | Replace raw `<select>`/`<textarea>` on top 6 pages | 2-3 hours | Phase 1 done |
| **Phase 6** | Write P1 tests (scoring edge cases, teams API) | 3-4 hours | Phase 3 done |
| **Phase 7** | Fix `next.config.js` (remove ignoreDuringBuilds) and resolve type/lint errors | 2-4 hours | Phases 2-5 done |
| **Phase 8** | Write P2 tests (http helpers, email, audit) | 2-3 hours | Phase 6 done |
| **Phase 9** | UX polish pass (loading states, error states, mobile fixes) | 3-5 hours | Phase 5 done |
| **Phase 10** | Historical AWS deployment option review (superseded Vercel + RDS setup) | 2-4 hours | Phases 1-9 done |

**Total estimated effort: 25-37 hours** (spread across 2-3 weeks at a sustainable pace).

---

## Appendix: File Index

Key files referenced throughout this document:

| Purpose | Path |
|---------|------|
| Shared HTTP helpers | `src/lib/http.ts` |
| Server re-export | `src/server/http.ts` |
| Permissions | `src/lib/permissions.ts` |
| Auth (sessions, passwords) | `src/lib/auth.ts` |
| Scoring engine | `src/lib/scoring.ts` |
| Rate limiting | `src/lib/rate-limit.ts` |
| Middleware (CSRF, rate limit, origin) | `src/middleware.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Test setup | `src/test/setup.ts` |
| Test fixtures | `src/test/fixtures.ts` |
| Test auth helper | `src/test/auth.ts` |
| Test HTTP helper | `src/test/http.ts` |
| Next.js config | `next.config.js` |
| Vitest config | `vitest.config.ts` |
