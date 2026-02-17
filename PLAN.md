# Plan: Repo Audit & Upgrade

## Snapshot
- Stack: Next.js 14 App Router, Prisma + Postgres, Tailwind, shadcn/ui, lucide-react, Zod.
- Structure: UI in `src/app`, API routes in `src/app/api`, shared in `src/lib`, features in `src/features`, server re-exports in `src/server`.
- Auth: custom session cookie + Prisma `Session` table. `src/lib/auth.ts`
- Roles: `STUDENT`, `SUPERVISOR`, `SUB_ADMIN`, `ADMIN`.
- Scoring engine: `src/lib/scoring.ts` (MAPE/APE).
- Docker + Prisma setup present.

## Completed
- Enforced core submission rules (locked on submit, round status checks, 3 active markets required).
- Warnings job fixed to only warn when a team truly misses a submission; DQ at 3.
- Leaderboards hide MAPE from student view; admin/supervisor see full details.
- Added submission receipt emails (student + supervisor).
- Support flow enforced: student ? supervisor; supervisor can escalate to admin; auto-escalate job kept.
- Admin actuals page upgraded (filters, search, edit/void/unvoid with audit history).
- Admin audit log access gated by permissions; UI uses `AccessDenied`.
- Admin/sub-admin permissions enforced on actuals and audit routes.
- Lint, typecheck, tests passing. Prisma migrate reset + dev confirmed.

## Verification Status
- `npm run lint` ✅ (Feb 15, 2026)
- `npm run typecheck` ✅ (Feb 15, 2026)
- `npm test` ✅ (Feb 15, 2026)
- `npx prisma migrate dev` ✅ (after `prisma migrate reset --force`)

## Remaining (Optional / Future)
- Add React Query + react-hook-form if still desired by PRD.
- Further UI polish across dashboards and landing page.
