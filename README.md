# RevME Forecaster Cup

SaaS-style forecasting competition platform for hospitality revenue management, with role-based dashboards, scoring, and admin tools.

## Features
- Student, Supervisor, Admin, and Sub-admin roles with permissions
- Season and round management (open/close), submissions, and scoring
- Occupancy + ADR leaderboards and scoring verification
- Support ticket flow (student → supervisor → admin escalation)
- Audit logs and admin command center

## Tech Stack
- Next.js (App Router), React, TypeScript
- Prisma + PostgreSQL
- Tailwind CSS, shadcn/ui, lucide-react
- Vitest for tests

## Prerequisites
- Node.js 18+ (recommended 20+)
- npm
- Docker (for local Postgres)

## Environment
Create a local env file:
```bash
cp .env.example .env.local
```
Required values:
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`

Optional (email):
- `SMTP_*`
- `DEMO_REQUEST_NOTIFY_EMAIL`

Test env:
```bash
cp .env.test.example .env.test
```
If your local Docker volume already has older Postgres credentials, add a machine-local override in `.env.test.local`.

## Local Dev (Node)
```bash
npm install
npm run db:generate
npm run dev
```
App runs at `http://localhost:5000`.

## Local Dev (Docker Compose)
```bash
cp .env.docker.example .env.docker
docker compose -f docker-compose.dev.yml up --build
```
The app runs at `http://localhost:5000` and Postgres is provisioned via compose.

## Database
```bash
npx prisma migrate dev
```

## Verification
```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Key Scripts
- `npm run dev` – Next.js dev server
- `npm run lint` – ESLint
- `npm run typecheck` – TypeScript typecheck
- `npm test` – Vitest
- `npm run build` – Production build
- `npm run db:generate` – Prisma client
- `npm run db:studio` – Prisma Studio

## Documentation

- **Architecture**: see `docs/ARCHITECTURE.md` for a high-level overview of the system (frontend, backend, database, auth, scoring, and key modules).
- **Admin & Operations Runbook**: see `docs/admin-runbook.md` for step-by-step guidance on running a season, weekly operations, support/escalations, and end-of-season workflows.
- **Product Requirements**: see `docs/PRD_RevME_Forecaster_Cup.md` for detailed functional requirements, UX flows, and non-functional requirements.
- **Staging Env Sheet**: see `docs/STAGING_ENV_SHEET.md` for the required staging variables, ownership, and value sources.
- **Improvements Roadmap**: see `docs/IMPROVEMENTS.md` for a prioritized roadmap covering API normalization, UX fixes, test expansion, build hardening, and AWS deployment.

## Deployment Notes (High Level)
- Use a managed Postgres (e.g., RDS)
- Set env vars in your deployment environment using a single canonical `NEXT_PUBLIC_APP_URL`
- Verify migrations with `npx prisma migrate status` before deploy
- Run `npx prisma migrate deploy` on deploy
- Never use `prisma db push` in staging or production
- Use `/api/health` for container or load balancer readiness checks
- Start with `npm run build` + `npm run start`
