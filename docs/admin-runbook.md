## RevME Forecaster Cup – Admin & Operations Runbook

This runbook explains how to operate the RevME Forecaster Cup competition using the web application, from pre-season setup through weekly operations and season wrap‑up.

It is written for:
- **Competition organizers / admins** (role: `ADMIN` or `SUB_ADMIN`)
- **Technical helpers** who may assist with setup, troubleshooting, or AWS operations

For detailed product requirements and UX specs, see `docs/PRD_RevME_Forecaster_Cup.md`. For a technical architecture overview, see `docs/ARCHITECTURE.md`.

---

## Roles & Key Concepts

- **Admin (Organizer)**: Configures seasons, markets, rounds, uploads actuals, runs scoring, manages users/teams, and monitors health.
- **Sub‑Admin**: Limited admin; permissions depend on `UserPermission` and `hasFullAccess`.
- **Supervisor (Instructor)**: Manages teams and students, reviews join requests and support tickets, and monitors participation.
- **Student (Team Member)**: Participates in the competition and submits forecasts (if designated as submitter).

Core competition concepts:
- **Season** – A competition run (e.g., “Fall 2025”) with 7 rounds.
- **Round** – A weekly forecasting window with a deadline.
- **Markets** – The 3 hotel markets students forecast for each round.
- **Submission** – A locked set of predictions for a team, round, market, metric, and weekOffset.
- **Actuals** – The true occupancy and ADR values for each round/market/weekOffset.
- **Warnings / Disqualification** – Automated or manual flags when teams miss submissions; 3 missed submissions leads to disqualification (DQ).

---

## 1. Before a New Season

These steps should be done before inviting participants.

### 1.1 Configure the Season

1. Sign in as an `ADMIN`.
2. Go to the **Season** section in the admin dashboard.
3. Create a new season with:
   - **Name** (e.g., “Fall 2025”).
   - **Start/End dates**.
   - **Status** = `DRAFT`.
   - **Registration flag**: keep registration closed until you are ready to invite participants.

### 1.2 Configure Markets

1. As `ADMIN`, open the **Market Info** / markets configuration section.
2. Ensure exactly **3 active markets** are linked to the new season.
3. Confirm that each market has:
   - A clear display name.
   - Optional descriptive text and resource links if you want richer market info for students.

The application enforces business rules assuming **3 active markets** per season. Do not proceed with onboarding until this is correct.

### 1.3 Configure Rounds

1. As `ADMIN`, open the **Season / Rounds** area.
2. For the new season, create **7 rounds**:
   - Rounds **1–6**:
     - `isFinal = false`.
     - `opensAt` and `closesAt` spaced one week apart.
   - Round **7**:
     - `isFinal = true`.
     - `opensAt` and `closesAt` for the final week.
3. Check that:
   - The current date/time is **before** the first `opensAt`.
   - There are no overlapping windows unless that is intentional.

### 1.4 Dry-Run in a Test Season (Recommended)

Create a test season (or reuse an existing one) to validate:

1. Registration flows:
   - Register a supervisor and a student using test email addresses.
   - Create teams and join requests.
2. Submission flows:
   - Mark a round as open.
   - Submit dummy forecasts for a test team.
3. Scoring flows:
   - Upload simple actuals (e.g., all values = 100).
   - Run scoring via the **Scoring Control Center**.
   - Verify leaderboards and score trends.

Once you are confident in the flow, repeat the configuration steps for the real season.

---

## 2. Onboarding Universities, Supervisors, and Students

### 2.1 Supervisors (Instructors)

1. Supervisors visit the landing page and click **Register**.
2. They choose **“Supervisor/Instructor”** as their role and provide:
   - University name.
   - First name, last name, email.
3. The system will:
   - Create or reuse a `University` record as needed.
   - Mark them as `SUPERVISOR`.

As an admin, you can:
- Review new supervisors in **Admin → Users**.
- Upgrade or adjust roles if needed (e.g., supervise plus admin).

### 2.2 Teams

Supervisors are responsible for creating and managing their own teams.

Typical workflow:

1. Supervisor logs in and opens the **Supervisor Dashboard**.
2. Clicks **Create Team** and provides:
   - Team name.
3. The system:
   - Creates a `Team` linked to the supervisor, season, and university.
   - Enforces the max **10 teams per supervisor** rule.

Admins can:
- See all teams and statuses in **Admin → Teams** (counts, statuses, submissions, warnings).
- Manually disqualify or reinstate teams when necessary.

### 2.3 Students and Join Requests

1. Students self-register as **Students** via the **Register** page.
2. Students navigate to **Join Team** and request to join a supervisor/team (depending on your configuration).
3. Supervisors manage join requests in **Supervisor → Join Requests**:
   - Add student to an existing team (with capacity).
   - Create a new team and add the student.
   - Reject the request.

Constraints:
- Max **5 students per team** (enforced by the application).
- Exactly **one submitter per team** (via `isSubmitter` on `TeamMember`).

As an admin, you generally do not need to intervene unless:
- Supervisors are stuck, or
- You want to adjust rosters centrally (using **Admin → Teams** or **Admin → Users**).

---

## 3. Weekly Round Operations

Once a season is `ACTIVE` and rounds have been configured, admins follow this weekly loop:

### 3.1 Before the Round Opens

1. Verify in **Season / Rounds** that:
   - The next round has the correct `opensAt` and `closesAt`.
2. Optionally send a reminder (outside the system) that the round is about to open.

### 3.2 During the Submission Window

Supervisors and students primarily interact with:
- Student **Dashboard** & **Submit** pages.
- Supervisor **Dashboard**, **Teams**, and **Join Requests** pages.

Admins should:
1. Monitor **Admin Dashboard / Command Center**:
   - Total active teams.
   - Submissions this round.
   - Warnings, if any.
2. Monitor **Scoring Control Center**:
   - Submission coverage: `teamsWithSubmissions / totalActiveTeams` per round.
   - Any early signs of misconfiguration (e.g., wrong round open).

If you discover configuration errors (wrong times, wrong round), fix them immediately before the deadline passes.

### 3.3 After the Round Closes – Upload Actuals

Once the submission deadline has passed:

1. Confirm in **Season / Rounds** that the current round is `CLOSED` or its `closesAt` is in the past.
2. As `ADMIN`, navigate to the **Actuals** admin area.
3. Upload or enter **actual occupancy and ADR values** for:
   - Each active market.
   - Week offsets (typically Week+1 and Week+2, except Round 7).
4. Validate that:
   - The number of actuals matches expectations (e.g., `expectedActuals` in Scoring Control Center).
   - There are no obvious data entry mistakes (0 vs 100, etc.).

The admin UI and `Scoring Control Center` will show actual coverage per round.

### 3.4 Run the Scoring Job

1. As `ADMIN`, open **Admin → Scoring** (Scoring Control Center).
2. Choose the scope:
   - **Score All Rounds** (recommended; idempotent) or
   - **Specific Round** (just the round that has new actuals).
3. Click **Run Scoring**.
4. Wait for the job to complete and review:
   - Status = `SUCCESS`.
   - `submissionsProcessed`, `errorsUpserted`, and `aggregatesUpserted` look reasonable.
   - No error message.
5. Confirm:
   - Rounds with actuals are now locked.
   - `scoresStale` flags are cleared for those rounds.

The system:
- Upserts `PredictionError` and `ScoreAggregate` rows.
- Updates `ScoringRun` history for audit.
- Locks actuals for scored rounds.

### 3.5 Publish & Communicate Results

After scoring succeeds:

1. Verify updated **Leaderboards** and **Scores** pages:
   - Leaderboard rankings look plausible.
   - Student **Scores** page shows new points and trends.
2. Check notifications:
   - The system creates in-app notifications for students and supervisors when leaderboards are updated.
3. Optionally send external communication:
   - Email or LMS announcement linking to the leaderboard or your own summary.

Repeat this loop for each round until Round 7 is scored.

---

## 4. Support & Escalations

### 4.1 Student Support Flow

1. Students open **Support** in the dashboard.
2. They create a new **support ticket** specifying category (e.g., Login, Submission, Scoring, Team).
3. Tickets created by students are automatically:
   - Associated with their team (if any).
   - Assigned to their supervisor (if they have one).
   - Given an initial status (e.g., `WAITING_ON_SUPERVISOR`).

### 4.2 Supervisor Inbox

Supervisors manage student tickets from **Supervisor → Support Inbox**:

1. Review incoming tickets for their students/teams.
2. Respond to student questions or issues.
3. Escalate to admins when necessary (depending on your configuration and UI).

### 4.3 Admin Escalations

Admins view escalated tickets from the **Admin** support/escalations section:

1. Filter tickets by status `ESCALATED` or category.
2. Investigate using:
   - Ticket history and replies.
   - Team and user context (via Admin → Users/Teams).
3. Resolve the issue:
   - Adjust configuration or data if necessary.
   - Reply to the ticket with an explanation.
   - Mark status as `RESOLVED`.

Students can optionally provide feedback on resolved tickets (thumbs up or down), which can be used to continuously improve help content and processes.

---

## 5. Common Admin Tasks

### 5.1 Disqualifying / Reinstating Teams

Disqualification is usually automatic after 3 missed submissions, but admins can also manually override.

**To disqualify a team manually:**
1. Go to **Admin → Teams**.
2. Find the team (use search/filter).
3. Open the team actions menu and select **Disqualify**.
4. Provide a reason (e.g., “Three missed submissions” or another justification).

**To reinstate a team:**
1. From **Admin → Teams**, filter by `DISQUALIFIED` status.
2. Select the team and choose **Reinstate**.
3. Optionally log the reason for reinstatement in admin notes or an external doc if needed.

The system:
- Updates `Team.status` and disqualification metadata.
- Logs actions via `AuditLog`.

### 5.2 Fixing Incorrect Actuals

If you discover that actuals were entered incorrectly:

1. Go to the **Actuals** admin area.
2. Correct the values for the affected round(s) and markets.
3. In **Scoring Control Center**:
   - You should see `scoresStale = true` for rounds whose actuals changed.
4. Re-run scoring (either for all rounds or just the affected round).

The corrected scoring run will:
- Produce new `PredictionError` and `ScoreAggregate` values.
- Record a new `ScoringRun` entry with updated `actualsVersionAtRun` and summary.

### 5.3 Forcing User Logout / Resetting Password

**To force logout:**
1. Go to **Admin → Users**.
2. Find the user.
3. Use **Force Logout** in the actions menu.
4. Confirm when prompted.

This removes active `Session` entries for that user.

**To generate a password reset link:**
1. Go to **Admin → Users**.
2. Use **Generate Reset Link** for the user.
3. Copy the generated link and send it securely to the user.
4. The link usually expires after a limited time window (e.g., 24 hours).

### 5.4 Handling “Not on a Team” Students

If a student reports they cannot submit because they are not on a team:

1. Check **Admin → Users**:
   - Confirm their role is `STUDENT` and their email matches expectations.
2. Check **Admin → Teams** or the supervisor dashboard:
   - Ensure they have been added as a `TeamMember`.
   - Verify that the team has a designated `isSubmitter`.
3. If they are not yet on a team:
   - Ask their supervisor to accept their join request or add them to a team.
4. If they should be submitter:
   - Ensure `isSubmitter = true` for them in the team roster.

---

## 6. End-of-Season Activities

When Round 7 scoring is complete and you are ready to finalize the season:

### 6.1 Final Scoring & Verification

1. Use **Scoring Control Center** to check:
   - All rounds have full actuals coverage.
   - No rounds are marked `scoresStale`.
   - Recent `ScoringRun` status is `SUCCESS`.
2. Spot-check:
   - A few teams across the leaderboard to make sure scores look reasonable.
   - That disqualified teams appear appropriately.

### 6.2 Freeze Leaderboards

Decide on a cut-off time after which:

1. You will not:
   - Change actuals, rounds, or team statuses that affect scoring.
   - Re-run scoring, except in extreme circumstances (documented externally).
2. Consider exporting a snapshot of the leaderboard for archival:
   - CSV exports (via `/api/submissions/export` or admin export endpoints).
   - Screenshots or PDFs if needed for marketing or reporting.

### 6.3 Export & Archive Data

1. Use the available export endpoints (e.g., submissions history CSV) to:
   - Archive team-level submissions and scoring.
   - Provide data to instructors if required.
2. In your infra (e.g., AWS):
   - Ensure database backups are running (see `docs/AWS_MIGRATION.md` for RDS checklist).
   - Store exports in durable storage (e.g., S3) if you need long-term archives.

### 6.4 Mark Season as Completed

1. In **Admin → Season**, set the season status to `COMPLETED`.
2. Optionally:
   - Close registration.
   - Ensure no further modifications are made to rounds or markets.
3. Communicate final results to:
   - Instructors and students.
   - Any external stakeholders (sponsors, academic departments, etc.).

---

## 7. Incident Playbook (Common Issues)

This section provides quick recipes for frequent or high-impact issues.

### 7.1 Wrong Actuals Uploaded

**Symptom**
- Leaderboard or scores look obviously incorrect.

**Steps**
1. Identify which round(s) and market(s) are affected.
2. Correct the actual values in the **Actuals** admin UI.
3. Go to **Scoring Control Center**:
   - Confirm rounds now show `scoresStale = true`.
   - Re-run scoring for all rounds or for just the affected round.
4. Communicate to users that scores have been corrected (if they might have seen the wrong ones).

### 7.2 Round Misconfigured (Wrong Times)

**Symptom**
- Students cannot submit when they should, or can still submit after the intended deadline.

**Steps**
1. In **Season / Rounds**, review `opensAt` and `closesAt` for the round.
2. If the mistake is still in the future:
   - Adjust the timestamps to the correct ones.
3. If the mistake is in the past and students were blocked:
   - Decide on a policy (e.g., temporarily reopen, accept manual submissions, or skip).
   - If reopening:
     - Adjust `closesAt`, update any communication, and allow an extended window.

### 7.3 User Cannot Log In

**Symptom**
- User reports invalid credentials or inability to access despite having an account.

**Steps**
1. Search for the user in **Admin → Users**:
   - Confirm that their account exists and role is correct.
2. Generate a password reset link and send it to them.
3. If still failing, verify:
   - They are using the right email address (case-insensitive).
   - There are no typos in domains (`.edu`, etc.).

### 7.4 Scores Not Updating After Actuals Change

**Symptom**
- Actuals were corrected but leaderboards or student score pages still show old results.

**Steps**
1. Confirm in **Scoring Control Center** that:
   - A new scoring run has been executed after the actuals change.
   - Recent `ScoringRun` has `status = SUCCESS`.
2. If not:
   - Re-run scoring for all rounds or the specific round.
3. Clear browser cache if necessary, or ask users to refresh the page if you recently deployed changes.

### 7.5 Excessive Missed Submissions / Teams Dropping Out

**Symptom**
- Many teams are close to or past auto-disqualification thresholds.

**Steps**
1. In **Admin → Teams** and **Scoring Control Center**:
   - Identify teams with 2 or more warnings.
2. Decide whether to:
   - Strictly enforce auto DQ at 3 warnings, or
   - Grant exceptions (manual override via reinstating after auto DQ).
3. Communicate policy clearly to supervisors to ensure fairness.

---

## 8. Quick Checklists

### 8.1 Pre-Season Checklist

- [ ] New season created in `DRAFT` status.
- [ ] Exactly 3 active markets configured.
- [ ] 7 rounds created with correct `opensAt` and `closesAt`.
- [ ] Test season run-through completed (optional but recommended).
- [ ] Registration window defined and communicated.

### 8.2 Weekly Round Checklist

- [ ] Round open/close times confirmed.
- [ ] Submission coverage monitored during the week.
- [ ] After deadline: actuals uploaded for all markets and weeks.
- [ ] Scoring run executed and marked `SUCCESS`.
- [ ] Leaderboards and score pages reviewed.
- [ ] Participants notified that scores are live.

### 8.3 End-of-Season Checklist

- [ ] All rounds have full actuals coverage.
- [ ] No rounds are marked `scoresStale`.
- [ ] Final scoring run completed and verified.
- [ ] Leaderboards exported and archived.
- [ ] Season marked as `COMPLETED`.
- [ ] Final communications sent to participants and stakeholders.

With this runbook and the architecture document, an experienced engineer or organizer should be able to operate the competition with minimal hand-holding and safely extend the platform when required.

