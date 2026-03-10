# Staging Go/No-Go Checklist

Use this checklist before promoting any build to production.

## Entry Criteria
- [ ] Release branch is frozen (deploy fixes only).
- [ ] `npm run lint` passed.
- [ ] `npm run typecheck` passed.
- [ ] `npm test` passed (no infra skips).
- [ ] `npm run build` passed.
- [ ] No hardcoded credentials in seed scripts or API collections.

## Functional Validation
- [ ] Auth/RBAC:
  - [ ] Student blocked from admin routes.
  - [ ] Supervisor blocked from admin routes.
  - [ ] Admin has expected access.
- [ ] Round lifecycle:
  - [ ] Season must be active.
  - [ ] Only one round open at a time.
  - [ ] Submission gating follows round status.
- [ ] Submission integrity:
  - [ ] Submitter-only rule enforced.
  - [ ] Locked submission cannot be edited.
  - [ ] Round 7 week-offset behavior verified.
- [ ] Scoring integrity:
  - [ ] Scoring run succeeds.
  - [ ] Leaderboard updates.
  - [ ] Scoring verification matches expected values.
- [ ] Warnings and DQ:
  - [ ] Missed submissions produce warnings.
  - [ ] Threshold behavior for disqualification verified.
- [ ] Admin operations:
  - [ ] Upload actuals works.
  - [ ] Process missed submissions works.
  - [ ] Round reminder workflow runs without errors.

## Reliability and Operations
- [ ] `/api/health` returns healthy.
- [ ] Application logs are visible.
- [ ] Error logs are actionable.
- [ ] CloudWatch alarms configured and tested.
- [ ] DB backup/snapshot created before cutover.
- [ ] Rollback procedure documented and tested.

## Go/No-Go Rules
- **GO** only if all checklist items pass and there are no Sev-1/Sev-2 defects.
- **NO-GO** if any critical workflow fails, data mismatch appears, or authorization boundaries fail.
