# QA Checklist

## Setup
- [ ] `npm install`
- [ ] `npm run db:generate`
- [ ] `npx prisma migrate dev`
- [ ] `npm run dev` (app at `http://localhost:5000`)

## Automated Tests
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`

## Admin
- [ ] Login as Admin.
- [ ] Season: create or open a season; verify exactly 3 active markets required to activate.
- [ ] Rounds: open a round only when season is ACTIVE; confirm only one round can be OPEN at a time.
- [ ] Market Info: create/edit Market Info and Round Updates; confirm entries persist.
- [ ] Teams: approve/reject pending teams; confirm status changes on supervisor view.
- [ ] Actuals:
  - [ ] Upload single actuals for Round/Market/Week.
  - [ ] Upload bulk actuals via CSV textarea.
  - [ ] View/Edit/Delete actuals; confirm audit history shows revisions.
  - [ ] Lock/unlock round actuals with reason; confirm scoresStale on changes after scoring.
- [ ] Scoring:
  - [ ] Run scoring (season scope) after actuals upload.
  - [ ] Verify leaderboard updates and scoring verification page works.
- [ ] Warnings:
  - [ ] Run warnings job after a round closes; verify only teams missing submissions get warnings.
  - [ ] After 3 warnings, team becomes DISQUALIFIED.
- [ ] Audit Logs:
  - [ ] View audit logs and export CSV.

## Supervisor
- [ ] Register/login as Supervisor.
- [ ] Create team; confirm status is `PENDING_APPROVAL` until Admin approves.
- [ ] Add students to team (max 5) and designate submitter.
- [ ] Join requests: accept/reject student requests.
- [ ] Support Inbox:
  - [ ] View student tickets.
  - [ ] Reply and set status to `WAITING_ON_STUDENT`.
  - [ ] Escalate to Admin with reason; verify ticket appears in Admin Escalations.

## Student
- [ ] Register/login as Student.
- [ ] Request to join supervisor via Join Team page.
- [ ] Once approved and added to a team, open Submit page.
- [ ] Submissions:
  - [ ] Ensure round status is OPEN and season ACTIVE.
  - [ ] Submit for all markets/weeks (Round 7 only Week +1).
  - [ ] Confirm submission locks immediately and cannot be edited.
- [ ] Leaderboards:
  - [ ] Student view hides MAPE values (only ranks; highlight own team).
- [ ] Support:
  - [ ] Open a ticket to Supervisor; verify status updates on replies.

## System Rules
- [ ] Exactly 3 active markets enforced (cannot submit/start season otherwise).
- [ ] 7 rounds total, Round 7 is Week+1 only.
- [ ] Warnings on 3 missed submissions ? DISQUALIFIED.
- [ ] Email receipts sent on submission (student + supervisor).
