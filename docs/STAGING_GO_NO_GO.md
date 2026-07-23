# Staging Go/No-Go Checklist

Run these checks after each staging deployment and before any production promotion.

## Must-Pass Checks
1. **Health and readiness**
   - `GET /api/health` returns `200`
   - Response reports `app=ok` and `db=ok`

2. **Auth and session cookies**
   - Login works over `https`
   - Logout clears the session correctly
   - Session persists with the production cookie settings

3. **RBAC boundaries**
   - Student cannot access admin pages or admin APIs
   - Supervisor cannot access admin pages or admin APIs
   - Admin can access the expected admin workflows

4. **Student and supervisor core flow**
   - Register or login succeeds
   - Student can join a team or see the correct team state
   - Supervisor can create or manage a team
   - Submitter can submit a forecast and see dashboard state update

5. **Admin scoring flow**
   - Admin can upload actuals
   - Scoring run succeeds
   - Leaderboard and score views update after scoring

6. **Release safety**
   - `npx prisma migrate status` passed before deploy
   - Application logs are visible
   - Backup and rollback steps are documented before sign-off

## Go/No-Go Rule
- **GO** only if all six checks pass with no Sev-1 or Sev-2 defects.
- **NO-GO** if any critical workflow fails, readiness is unstable, or authorization boundaries are broken.
