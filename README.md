# RevME Forecaster Cup

Production-grade Next.js App Router app for the RevME forecasting competition.

## Prerequisites
- Node.js 18+ (recommended 20+)
- npm
- Docker (for local Postgres)

## Environment
Copy `.env.example` to `.env.local` and fill in values. Minimal local dev values:
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `SMTP_*` (optional for emails)

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
```

## Tests
- Uses `vitest` and `.env.test` for DB config.
- Tests run sequentially to avoid DB contention.

## Key Scripts
- `npm run dev` – Next.js dev server
- `npm run lint` – ESLint
- `npm run typecheck` – TypeScript typecheck
- `npm test` – Vitest
- `npm run db:generate` – Prisma client
- `npm run db:studio` – Prisma Studio

## Notes
- Submissions lock immediately after submit.
- Rounds are controlled by admin (open/close) and respect America/New_York deadlines.
- Support flow: Student ? Supervisor; Supervisor can escalate to Admin.
