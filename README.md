# RevME Forecaster Cup

> Production-grade SaaS forecasting competition platform 
> serving 100+ teams across 29 universities worldwide in 
> hospitality revenue management.

🔗 **Live Platform:** [https://staging.rev-me.org/](https://your-live-url.com)  
📄 **Built by:** [Amarnath Goud Mammidipally](https://linkedin.com/in/amarnath240) · MS CS, University of Delaware

---

## What This Is

RevME Forecaster Cup replaced entirely manual spreadsheet 
and email workflows with a fully automated, role-based 
competition platform for international hospitality 
forecasting competitions. Teams submit weekly occupancy 
and ADR forecasts across 3 markets, and the platform 
handles scoring, leaderboards, warnings, and reporting 
automatically.

**Scale:**
- 100+ competing teams · 29 universities worldwide
- 7 rounds per season · 3 markets · 2 metrics (Occupancy + ADR)
- 78 predictions per team per season
- Full audit trail on every admin action

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (serverless-style handlers) |
| Database | PostgreSQL via Prisma ORM |
| Auth | Custom session system, HTTP-only cookies, bcrypt, CSRF protection |
| Testing | Vitest with DB reset, session mocking, fixtures |
| Deployment | AWS EC2 + RDS PostgreSQL + Docker + CI/CD |

---

## Key Features

**Competition Management**
- Season and round lifecycle (draft → active → completed)
- Automated deadline enforcement and submission locking
- Round-level actuals upload and idempotent scoring engine
- MAPE/MAE-based prediction error computation with 
  zero-actual edge case handling

**Role-Based System**
- Four roles: Student, Supervisor, Sub-Admin, Admin
- Fine-grained permissions via `UserPermission` table
- Tiered rate limiting (10/60/120 req/min) in middleware
- CSRF protection on all state-changing endpoints

**Scoring Engine**
- Per-value absolute error (AE) and APE computation
- Season and round-level MAPE aggregation
- Auditable `ScoringRun` records with version tracking
- Stale-score detection when actuals change

**Admin Control Center**
- Command center dashboard with real-time competition metrics
- Actuals upload, scoring triggers, warnings automation
- Team disqualification/reinstatement with audit logging
- Support ticket escalation (Student → Supervisor → Admin)

**Leaderboards & Reporting**
- Occupancy and ADR leaderboards with rank tracking
- Per-team score trends and round history
- CSV export for submissions and audit logs
- Email notifications via AWS SES

---

## Architecture
Browser → Next.js App Router
↓
API Routes (68 endpoints)
↓
Prisma Client
↓
PostgreSQL (AWS RDS)

**Auth flow:** HTTP-only `revme_session` cookie →
`getSession()` → User + role → route handler

**Scoring flow:** Admin triggers → `ScoringRun` created →
submissions × actuals → `PredictionError` rows →
`ScoreAggregate` upsert → leaderboard updated

---

## Local Setup

### Option A — Node.js
```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local
# Set DATABASE_URL and NEXT_PUBLIC_APP_URL

# 3. Run migrations
npx prisma migrate dev

# 4. Generate Prisma client
npm run db:generate

# 5. Start dev server
npm run dev
```

App runs at `http://localhost:5000`

### Option B — Docker Compose
```bash
cp .env.docker.example .env.docker
docker compose -f docker-compose.dev.yml up --build
```

App + PostgreSQL provisioned at `http://localhost:5000`

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | ✅ | Base URL for the app |
| `SMTP_*` | Optional | Email via AWS SES |
| `DEMO_REQUEST_NOTIFY_EMAIL` | Optional | Demo request alerts |

See `.env.example` for the full list.

---

## Verification
```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # Vitest
npm run build       # Production build
```

---

## Database
```bash
npx prisma migrate dev      # Development migrations
npx prisma migrate deploy   # Production migrations
npx prisma migrate status   # Check migration state
npm run db:studio           # Prisma Studio UI
```

⚠️ Never use `prisma db push` in staging or production.

---

## Deployment

- Managed PostgreSQL recommended (AWS RDS)
- Set all env vars in deployment environment
- Run `npx prisma migrate deploy` on every deploy
- Use `/api/health` for load balancer health checks
- Start with `npm run build` + `npm run start`

See `docs/AWS_MIGRATION.md` for full deployment guide.

---

## Documentation

| Doc | Purpose |
|---|---|
| `docs/ARCHITECTURE.md` | System architecture, auth, scoring, data model |
| `docs/admin-runbook.md` | Season operations, weekly workflow, escalations |
| `docs/PRD_RevME_Forecaster_Cup.md` | Full product requirements and UX flows |
| `docs/IMPROVEMENTS.md` | Prioritized roadmap: API, UX, tests, deployment |
| `docs/STAGING_ENV_SHEET.md` | Staging variables, ownership, value sources |

---

## About

Built as part of graduate research at the University of 
Delaware to support the international RevME Forecaster Cup 
competition in hospitality revenue management.

**Amarnath Goud Mammidipally**  
MS Computer Science · University of Delaware · GPA 3.74  
[linkedin.com/in/amarnath240](https://linkedin.com/in/amarnath240) · 
[github.com/Amar240](https://github.com/Amar240)
