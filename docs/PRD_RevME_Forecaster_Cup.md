# RevME Forecaster Cup Platform - Product Requirements Document

**Version:** 1.0  
**Date:** January 17, 2026  
**Author:** RevME Product Team  
**Domain:** https://rev-me.org/

---

## PHASE 1: Excel → System Understanding Report

### 1.1 File Analysis Summary

#### File 1: 25F-ALL Teams Forecaster Cup (V5).csv
**Purpose:** Master roster of all teams participating in the Fall 2025 competition

**Key Columns:**
| Column | Description |
|--------|-------------|
| TeamNumber | Sequential numeric ID (1-92) |
| Institution | University name |
| TeamID | Concatenation of Institution + sequential number |
| TeamName | Optional team display name |
| First Name | Team member/submitter first name |
| Last Name | Team member/submitter last name |
| Email | Contact email for the team member |

**Key Insights:**
- 92 teams across 29 universities
- Top universities: University of Delaware (12 teams), Toronto Metropolitan (9 teams)
- One row per team (single contact person listed)

#### File 2: Missed Submissions W2 - Instructors.xlsx
**Purpose:** Tracks teams that failed to submit forecasts each week

**Key Columns:**
| Column | Description |
|--------|-------------|
| Team Num | Team number reference |
| Team | Team/Institution name |
| W1-W7 | Binary flag (1 = missed) per week |
| Total | Cumulative missed submissions |
| Removed | Flag if team disqualified (3+ misses) |

**Business Logic:** After 3 missed submissions, team is disqualified.

#### File 3: Forecaster Cup Registration Form - CETT.xlsx
**Purpose:** Instructor registration form per university

**Key Fields:**
- Your University
- Instructor's Name
- Instructor's Email
- Team information (up to 10 teams per instructor)

#### File 4: Forecaster Cup F25 Week 1.xlsx
**Purpose:** Raw submission data exported from Qualtrics survey

**Key Columns:**
| Column | Description |
|--------|-------------|
| StartDate, EndDate | Submission timestamps |
| Institution | University name |
| TeamID, TeamNumber | Team identifiers |
| Prediction 1-3 | Forecast values for markets |

#### File 5: F25 Forecaster Cup Report (W1/W2) for Instructors.xlsm
**Purpose:** Weekly scoring report generated for instructors

**Key Sections:**
- Weekly Forecast submissions
- Actual values
- Absolute Error (AE) calculations
- Top Three Teams ranking
- Top Three Universities ranking

### 1.2 Excel-to-Database Mapping

| Excel Concept | Database Entity | Fields |
|--------------|-----------------|--------|
| University | University | id, name, country, createdAt |
| Instructor | User (Supervisor role) | id, email, firstName, lastName, universityId |
| Team roster | Team | id, name, universityId, supervisorId, submitterId |
| Team members | TeamMember (join table) | userId, teamId, isSubmitter |
| Predictions | Submission | id, teamId, roundId, marketId, occupancy, adr, submittedAt |
| Actual values | Actual | id, roundId, marketId, week, occupancy, adr |
| AE calculations | Score | id, submissionId, occupancyAE, adrAE |
| Missed tracking | Warning | id, teamId, roundId, type, createdAt |
| Competition setup | Season, Round, Market | Configuration entities |

### 1.3 Current Manual Weekly Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT MANUAL WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. REGISTRATION (Start of Season)                              │
│     ├─ Instructor fills out Excel registration form             │
│     ├─ Admin manually creates team list in master CSV           │
│     └─ Students get Qualtrics survey link                       │
│                                                                  │
│  2. WEEKLY SUBMISSION (Each Round)                              │
│     ├─ Teams submit via Qualtrics survey                        │
│     ├─ Admin exports responses to Excel                         │
│     └─ Manual data cleanup and validation                       │
│                                                                  │
│  3. MISSED SUBMISSIONS CHECK                                    │
│     ├─ Compare submitted teams vs roster                        │
│     ├─ Update Missed Submissions tracker                        │
│     └─ Flag teams with 3+ misses as disqualified                │
│                                                                  │
│  4. ACTUALS INGESTION                                           │
│     ├─ Download STR/industry data                               │
│     └─ Manually enter into scoring spreadsheet                  │
│                                                                  │
│  5. SCORING                                                     │
│     ├─ Calculate AE: |prediction - actual|                      │
│     ├─ Aggregate by team, market, metric                        │
│     └─ Generate rankings                                        │
│                                                                  │
│  6. REPORTING                                                   │
│     ├─ Create instructor report XLSM                            │
│     └─ Email reports to instructors                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE 2: Product Requirements Document

### A) Executive Summary

#### Vision
Create a world-class forecasting competition platform that automates the RevME Forecaster Cup, enabling seamless participation for students and supervisors while providing powerful administration tools for organizers.

#### Problem Statement
The current competition workflow relies on manual Excel processes:
- Registration via email and spreadsheets
- Submissions through Qualtrics surveys requiring manual export
- Manual tracking of missed submissions and disqualifications
- Time-consuming scoring calculations
- Delayed report generation and distribution

This manual process is:
- Error-prone (data entry mistakes, formula errors)
- Not scalable (92 teams is near maximum capacity)
- Time-intensive (hours per week for administration)
- Lacks real-time visibility for participants

#### Goals
1. **Automate 100%** of the manual weekly process
2. **Reduce admin time** from hours to minutes per week
3. **Enable real-time** submission tracking and scoring
4. **Support 500+ teams** with zero additional admin overhead
5. **Provide portfolio-quality** UX suitable for academic showcase

#### Success Metrics (KPIs)
| Metric | Target |
|--------|--------|
| Weekly admin time | < 15 minutes |
| Submission error rate | 0% |
| Time from deadline to scores published | < 1 hour |
| Platform uptime | 99.9% |
| User satisfaction (NPS) | > 50 |

#### Non-Goals
- Mobile native apps (responsive web only)
- Multi-language support (English only for MVP)
- Payment processing
- Integration with external LMS systems

---

### B) Personas & Journeys

#### Persona 1: Student (Forecaster)
**Demographics:** Undergraduate or graduate hospitality/business student  
**Goals:** Submit accurate forecasts, learn about revenue management, compete for recognition  
**Pain Points:** Unclear deadlines, no visibility into standing, confusing submission process

**Journey:**
```
1. Receives email invitation from supervisor
2. Creates account with .edu email
3. Views dashboard showing team assignment
4. Awaits round opening
5. Reviews market data and makes predictions
6. Submits forecast before deadline
7. Views submission confirmation (locked)
8. After scoring: views AE scores and leaderboard position
9. Repeats for 7 rounds
```

**Edge Cases:**
- Tries to submit after deadline → Blocked with clear message
- Tries to edit after submit → Blocked, sees locked status
- Not assigned to team → Dashboard shows "Awaiting team assignment"
- Team is disqualified → Sees DQ status, submissions blocked

#### Persona 2: Supervisor (Mentor/Instructor)
**Demographics:** University professor or industry mentor  
**Goals:** Manage team rosters, monitor student participation, access reports  
**Pain Points:** Managing multiple teams, tracking who submitted, generating reports

**Journey:**
```
1. Self-registers with institutional email
2. Creates teams (up to 10)
3. Adds students to teams by email
4. Designates one student as Team Submitter per team
5. Monitors submission status during rounds
6. Receives warning notifications for missed submissions
7. Downloads weekly reports
8. Views aggregate university performance
```

**Edge Cases:**
- Tries to add 6th student to team → Error: Maximum 5 students per team
- Tries to create 11th team → Error: Maximum 10 teams per supervisor
- Student email not registered → "Student must register first"
- Removes only submitter → Must designate new submitter

#### Persona 3: Admin (Organizer)
**Demographics:** Professor or research assistant running the competition  
**Goals:** Configure seasons, ingest actuals, trigger scoring, generate reports  
**Pain Points:** Manual data processing, ensuring data integrity, communication

**Journey:**
```
1. Creates new season with parameters (rounds, markets, deadlines)
2. Approves supervisor registrations
3. Monitors registration progress
4. Opens/closes rounds (or automated via schedule)
5. Uploads actual values after each week ends
6. Triggers scoring job
7. Runs missed submission check
8. Reviews and publishes leaderboards
9. Generates and distributes reports
10. At season end: finalizes rankings, exports data
```

**Edge Cases:**
- Uploads actuals with wrong format → Validation errors displayed
- Duplicate actual upload → Idempotent: updates existing values
- Manual DQ override → Can disqualify/reinstate teams

---

### C) Functional Requirements

#### C.1 Authentication & Onboarding

**FR-AUTH-001: Self-Registration**
- Users can register with email and password
- Email verification required before account activation
- Supported roles on registration: Student, Supervisor
- Admin accounts created by existing admins only

**FR-AUTH-002: Login**
- Email + password authentication
- Session-based authentication with secure cookies
- Password reset via email link
- Rate limiting: 5 failed attempts → 15 minute lockout

**FR-AUTH-003: Role Assignment**
- Students: Default role, cannot escalate
- Supervisors: Can be approved by Admin
- Admins: Must be granted by existing Admin

#### C.2 Team Management

**FR-TEAM-001: Team Creation (Supervisor)**
- Supervisors can create teams with name
- System generates unique TeamID
- Maximum 10 teams per supervisor (hard enforced)

**FR-TEAM-002: Roster Management**
- Supervisors add students by email (student must have account)
- Maximum 5 students per team (hard enforced)
- One student designated as Team Submitter (required)
- Supervisors can remove students and reassign submitter

**FR-TEAM-003: Team Constraints**
```sql
CHECK (students_count <= 5)
CHECK (teams_per_supervisor <= 10)
CHECK (exactly_one_submitter = TRUE)
```

#### C.3 Submission System

**FR-SUB-001: Round Schedule**
- 7 rounds per season
- Rounds 1-6: Predict Week+1 AND Week+2 (2 predictions)
- Round 7: Predict Week+1 only (1 prediction)
- Each round has closeAt timestamp

**FR-SUB-002: Submission Form**
- One submission per team per round per market
- 3 active markets × 2 metrics = 6 fields per market
- Total fields per round (R1-R6): 3 markets × 2 weeks × 2 metrics = 12
- Round 7: 3 markets × 1 week × 2 metrics = 6

**FR-SUB-003: Deadline Enforcement**
- Display countdown in America/New_York timezone
- Before deadline: Form enabled
- After deadline: Form disabled, submission blocked
- System rejects any API calls after closeAt

**FR-SUB-004: Submission Lock**
- Once submitted, values are LOCKED immediately
- No edits allowed even before deadline
- UI shows "Submitted" badge with timestamp
- Rationale: Prevents gaming based on late information

**FR-SUB-005: Submission Data**
```typescript
interface Submission {
  teamId: string;
  roundId: string;
  marketId: string;
  weekOffset: 1 | 2;  // Week+1 or Week+2
  occupancy: number;  // Percentage (0-100)
  adr: number;        // Currency amount
  submittedAt: DateTime;
  submittedBy: string; // User ID of submitter
}
```

#### C.4 Actuals Ingestion

**FR-ACT-001: Upload Interface**
- Admin uploads CSV/XLSX with actual values
- Required columns: Market, Week, Occupancy, ADR
- System validates format before accepting

**FR-ACT-002: Validation Rules**
- Market name must match configured markets
- Week must be valid for current season
- Occupancy: 0-100 (percentage)
- ADR: Positive number
- Duplicate uploads update existing values (idempotent)

**FR-ACT-003: Data Model**
```typescript
interface Actual {
  id: string;
  seasonId: string;
  marketId: string;
  week: number;        // Calendar week number
  occupancy: number;
  adr: number;
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

#### C.5 Scoring Engine

**FR-SCORE-001: Error Calculation**
- Absolute Error (AE) = |prediction - actual|
- Calculated per prediction (78 total per team per season)
- Formula: 6 rounds × 2 weeks × 3 markets × 2 metrics + 1 round × 1 week × 3 markets × 2 metrics = 72 + 6 = 78

**FR-SCORE-002: Aggregation**
- Mean Absolute Error (MAE) = Average of all AE values
- Per-market MAE
- Per-metric MAE (Occupancy MAE, ADR MAE)
- Cumulative MAE across all rounds

**FR-SCORE-003: Leaderboard Calculation**
- Separate leaderboards: Occupancy, ADR
- Ranking by ascending MAE (lower is better)
- Tie-breaker: Earlier first submission timestamp

**FR-SCORE-004: Scoring Job**
- Triggered manually by Admin after actuals uploaded
- Idempotent: Can re-run safely
- Transactional: All-or-nothing updates
- Publishes results to leaderboard

#### C.6 Leaderboards

**FR-LB-001: Leaderboard Types**
- Occupancy Leaderboard
- ADR Leaderboard
- Combined/Overall Leaderboard

**FR-LB-002: Filters**
- By Market: Nashville CBD, Dubai, Hamburg
- By Round: 1-7 or Cumulative
- By University
- By Team

**FR-LB-003: Display Data**
```typescript
interface LeaderboardEntry {
  rank: number;
  teamName: string;
  university: string;
  mae: number;
  roundsCompleted: number;
  trend: 'up' | 'down' | 'same';
}
```

#### C.7 Warnings & Disqualification

**FR-WARN-001: Warning Generation**
- After round closes, system identifies teams without submissions
- Creates Warning record for each missed submission
- Notification sent to team submitter and supervisor

**FR-WARN-002: Disqualification Logic**
```python
if team.warnings.count() >= 3:
    team.status = 'DISQUALIFIED'
    team.disqualifiedAt = now()
    team.disqualifiedReason = 'Three missed submissions'
```

**FR-WARN-003: Admin Override**
- Admin can manually disqualify teams
- Admin can reinstate teams (clear DQ status)
- All changes logged to audit trail

#### C.8 Reports

**FR-RPT-001: Weekly Report Generation**
- Auto-generate after scoring job completes
- PDF and Excel formats
- Contents: Submissions, AE scores, rankings, warnings

**FR-RPT-002: Report Access**
- Supervisors: Download reports for their teams/university
- Admins: Download all reports
- Students: View their team's scores (not full report)

**FR-RPT-003: Report Storage**
- Stored in object storage
- Retention: Indefinite during season, 2 years archive

#### C.9 Notifications

**FR-NOT-001: Email Notifications**
| Event | Recipients |
|-------|------------|
| Team invitation | Invited student |
| Round opens | All team submitters |
| 24h before deadline | Teams not yet submitted |
| Missed submission | Submitter + Supervisor |
| Scores published | All participants |
| Disqualification | Team + Supervisor |

**FR-NOT-002: In-App Notifications**
- Notification bell in header
- Unread count badge
- Click to mark read
- Link to relevant page

#### C.10 Admin Control Center

**FR-ADM-001: Season Management**
- Create new season with parameters
- Configure markets (exactly 3)
- Set round schedule (7 rounds with deadlines)
- Open/close registration

**FR-ADM-002: User Management**
- View all users by role
- Approve/reject supervisor registrations
- Promote user to Admin
- Deactivate accounts

**FR-ADM-003: Data Management**
- Upload actuals
- Trigger scoring job
- Run warnings job
- Export all data (CSV)

**FR-ADM-004: Dashboard Metrics**
- Total teams registered
- Submissions this round
- Pending warnings
- System health status

---

### D) RBAC / Permissions Matrix

| Feature | Student | Supervisor | Admin |
|---------|---------|------------|-------|
| Register account | ✓ | ✓ | - |
| View own profile | ✓ | ✓ | ✓ |
| Edit own profile | ✓ | ✓ | ✓ |
| Create team | - | ✓ | ✓ |
| Add team members | - | ✓ | ✓ |
| Remove team members | - | ✓ | ✓ |
| Submit forecast (if submitter) | ✓ | - | - |
| View team submissions | ✓ | ✓ (own teams) | ✓ |
| View leaderboard | ✓ | ✓ | ✓ |
| View own team scores | ✓ | ✓ | ✓ |
| View all scores | - | - | ✓ |
| Download team report | - | ✓ | ✓ |
| Download all reports | - | - | ✓ |
| Create season | - | - | ✓ |
| Configure markets | - | - | ✓ |
| Upload actuals | - | - | ✓ |
| Trigger scoring | - | - | ✓ |
| Manage users | - | - | ✓ |
| Disqualify team | - | - | ✓ |

---

### E) Data Model + Constraints

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  firstName     String
  lastName      String
  role          Role      @default(STUDENT)
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  supervisedTeams Team[]  @relation("Supervisor")
  teamMemberships TeamMember[]
  submissions     Submission[]
  notifications   Notification[]
  universityId    String?
  university      University? @relation(fields: [universityId], references: [id])
}

enum Role {
  STUDENT
  SUPERVISOR
  ADMIN
}

model University {
  id        String   @id @default(cuid())
  name      String   @unique
  country   String?
  createdAt DateTime @default(now())
  
  users     User[]
  teams     Team[]
}

model Team {
  id              String      @id @default(cuid())
  name            String
  displayId       String      @unique  // e.g., "UniversityName1"
  status          TeamStatus  @default(ACTIVE)
  disqualifiedAt  DateTime?
  disqualifiedReason String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  // Relations
  supervisorId    String
  supervisor      User        @relation("Supervisor", fields: [supervisorId], references: [id])
  universityId    String
  university      University  @relation(fields: [universityId], references: [id])
  members         TeamMember[]
  submissions     Submission[]
  warnings        Warning[]
  
  // Constraint: Max 10 teams per supervisor enforced at application level
}

enum TeamStatus {
  ACTIVE
  DISQUALIFIED
}

model TeamMember {
  id          String   @id @default(cuid())
  isSubmitter Boolean  @default(false)
  joinedAt    DateTime @default(now())
  
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  
  @@unique([userId, teamId])
  // Constraint: Max 5 members per team enforced at application level
  // Constraint: Exactly 1 submitter per team enforced at application level
}

model Season {
  id              String    @id @default(cuid())
  name            String    // e.g., "Fall 2025"
  status          SeasonStatus @default(DRAFT)
  registrationOpen Boolean  @default(false)
  startDate       DateTime
  endDate         DateTime
  createdAt       DateTime  @default(now())
  
  rounds          Round[]
  markets         SeasonMarket[]
}

enum SeasonStatus {
  DRAFT
  ACTIVE
  COMPLETED
}

model Market {
  id        String   @id @default(cuid())
  name      String   @unique  // Nashville CBD, Dubai, Hamburg
  createdAt DateTime @default(now())
  
  seasonMarkets SeasonMarket[]
  actuals       Actual[]
  submissions   Submission[]
}

model SeasonMarket {
  id        String  @id @default(cuid())
  seasonId  String
  season    Season  @relation(fields: [seasonId], references: [id])
  marketId  String
  market    Market  @relation(fields: [marketId], references: [id])
  isActive  Boolean @default(true)
  
  @@unique([seasonId, marketId])
  // Constraint: Exactly 3 active markets per season enforced at application level
}

model Round {
  id          String   @id @default(cuid())
  number      Int      // 1-7
  seasonId    String
  season      Season   @relation(fields: [seasonId], references: [id])
  opensAt     DateTime
  closesAt    DateTime // Deadline
  isFinal     Boolean  @default(false) // Round 7 is final
  
  submissions Submission[]
  actuals     Actual[]
  warnings    Warning[]
  
  @@unique([seasonId, number])
}

model Submission {
  id          String   @id @default(cuid())
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  roundId     String
  round       Round    @relation(fields: [roundId], references: [id])
  marketId    String
  market      Market   @relation(fields: [marketId], references: [id])
  weekOffset  Int      // 1 or 2 (Week+1 or Week+2)
  
  occupancy   Float    // Predicted occupancy (0-100)
  adr         Float    // Predicted ADR
  
  submittedAt DateTime @default(now())
  submittedById String
  submittedBy User     @relation(fields: [submittedById], references: [id])
  
  score       Score?
  
  @@unique([teamId, roundId, marketId, weekOffset])
}

model Actual {
  id          String   @id @default(cuid())
  roundId     String
  round       Round    @relation(fields: [roundId], references: [id])
  marketId    String
  market      Market   @relation(fields: [marketId], references: [id])
  weekOffset  Int      // 1 or 2
  
  occupancy   Float
  adr         Float
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([roundId, marketId, weekOffset])
}

model Score {
  id            String     @id @default(cuid())
  submissionId  String     @unique
  submission    Submission @relation(fields: [submissionId], references: [id])
  
  occupancyAE   Float      // |predicted - actual|
  adrAE         Float
  
  calculatedAt  DateTime   @default(now())
}

model Warning {
  id        String      @id @default(cuid())
  teamId    String
  team      Team        @relation(fields: [teamId], references: [id])
  roundId   String
  round     Round       @relation(fields: [roundId], references: [id])
  type      WarningType
  message   String?
  createdAt DateTime    @default(now())
  
  @@unique([teamId, roundId, type])
}

enum WarningType {
  MISSED_SUBMISSION
  LATE_SUBMISSION
  ADMIN_WARNING
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String
  title     String
  message   String
  link      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  
  @@index([userId, read])
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String
  entityType String
  entityId   String?
  details    Json?
  ipAddress  String?
  createdAt  DateTime @default(now())
  
  @@index([entityType, entityId])
}
```

#### Constraint Enforcement Summary

| Constraint | Enforcement |
|------------|-------------|
| Exactly 3 active markets per season | Application validation + DB trigger |
| Max 10 teams per supervisor | Application check before team creation |
| Max 5 students per team | Application check + COUNT query |
| Exactly 1 submitter per team | Application validation on roster changes |
| One submission per team/round/market/week | Unique constraint on Submission |
| Locked submissions after submit | No UPDATE endpoint; only INSERT |
| Deadline enforcement | Application check against closesAt |

---

### F) APIs (High-level Contract)

#### Authentication Endpoints
```
POST /api/auth/register     - Register new user
POST /api/auth/login        - Login, returns session
POST /api/auth/logout       - Logout, clears session
POST /api/auth/forgot       - Request password reset
POST /api/auth/reset        - Reset password with token
GET  /api/auth/me           - Get current user
```

#### Team Endpoints (Supervisor)
```
GET    /api/teams                - List supervisor's teams
POST   /api/teams                - Create team
GET    /api/teams/:id            - Get team details
PATCH  /api/teams/:id            - Update team name
DELETE /api/teams/:id            - Delete team (if no submissions)
POST   /api/teams/:id/members    - Add member
DELETE /api/teams/:id/members/:userId - Remove member
PATCH  /api/teams/:id/submitter  - Set submitter
```

#### Submission Endpoints (Student Submitter)
```
GET  /api/submissions            - Get team's submissions
GET  /api/submissions/current    - Get current round status
POST /api/submissions            - Submit forecast (locked on success)
```

#### Leaderboard Endpoints (All Users)
```
GET /api/leaderboards/occupancy  - Occupancy rankings
GET /api/leaderboards/adr        - ADR rankings
GET /api/leaderboards/combined   - Combined rankings
# Query params: market, round, university
```

#### Admin Endpoints
```
POST   /api/admin/seasons              - Create season
PATCH  /api/admin/seasons/:id          - Update season
GET    /api/admin/seasons/:id/stats    - Season statistics
POST   /api/admin/actuals              - Upload actuals (CSV)
POST   /api/admin/scoring/run          - Trigger scoring job
POST   /api/admin/warnings/run         - Run warnings job
GET    /api/admin/users                - List all users
PATCH  /api/admin/users/:id/role       - Update user role
POST   /api/admin/teams/:id/disqualify - Disqualify team
POST   /api/admin/teams/:id/reinstate  - Reinstate team
GET    /api/admin/reports              - List generated reports
GET    /api/admin/export               - Export all data
```

#### Error Responses
```typescript
// 400 Bad Request - Invalid input
{ error: "VALIDATION_ERROR", message: "...", details: {...} }

// 401 Unauthorized - Not logged in
{ error: "UNAUTHORIZED", message: "Authentication required" }

// 403 Forbidden - Wrong role
{ error: "FORBIDDEN", message: "Insufficient permissions" }

// 404 Not Found
{ error: "NOT_FOUND", message: "Resource not found" }

// 409 Conflict - Duplicate/constraint violation
{ error: "CONFLICT", message: "Submission already exists" }

// 422 Unprocessable - Business rule violation
{ error: "DEADLINE_PASSED", message: "Round deadline has passed" }
{ error: "TEAM_DISQUALIFIED", message: "Team is disqualified" }
{ error: "MAX_TEAMS_REACHED", message: "Maximum 10 teams per supervisor" }
```

---

### G) Non-functional Requirements

#### G.1 Security
- Password hashing: bcrypt with cost factor 12
- Session tokens: HTTP-only, Secure, SameSite cookies
- CSRF protection on all state-changing endpoints
- Input sanitization (prevent XSS, SQL injection via ORM)
- Rate limiting: 100 requests/minute per IP
- Audit logging: All admin actions logged
- Data encryption at rest (database-level)

#### G.2 Reliability
- Idempotent operations: Scoring job can be re-run safely
- Transactional scoring: All scores updated atomically
- Database backups: Daily automated snapshots
- Retry logic: Background jobs retry 3x with exponential backoff
- Health check endpoint: /api/health

#### G.3 Performance
- Expected load: 500 teams × 5 users = 2,500 users max
- Peak: 500 concurrent during deadline rush
- API response time: < 200ms p95
- Leaderboard queries cached for 5 minutes
- Database indexes on common query patterns

#### G.4 Observability
- Structured logging (JSON format)
- Request tracing with correlation IDs
- Error tracking integration
- Key metrics: Request latency, error rate, DB pool usage
- Dashboard for admin visibility

#### G.5 Data Privacy
- Email addresses stored encrypted
- GDPR-style data export capability
- Data retention: Active season + 2 years archive
- Right to deletion: Upon request, anonymize data

#### G.6 Disaster Recovery
- Database: Daily backups, 7-day retention
- Point-in-time recovery capability
- RTO: 4 hours, RPO: 1 hour
- Documented recovery procedures

---

### H) UX/UI Requirements

#### H.1 UX Principles
1. **Clarity**: Always show current round, deadline, and status
2. **Confidence**: Submission confirmation with clear lock indication
3. **Progress**: Visual progress through 7 rounds
4. **Guidance**: Contextual help for first-time users
5. **Speed**: Instant feedback on all actions

#### H.2 Design System

**Colors:**
```css
--primary: #2563EB;      /* Blue 600 */
--primary-dark: #1D4ED8; /* Blue 700 */
--secondary: #10B981;    /* Emerald 500 */
--warning: #F59E0B;      /* Amber 500 */
--error: #EF4444;        /* Red 500 */
--background: #F9FAFB;   /* Gray 50 */
--surface: #FFFFFF;
--text-primary: #111827; /* Gray 900 */
--text-secondary: #6B7280; /* Gray 500 */
```

**Typography:**
- Font: Inter (headings), System UI (body)
- Scale: 12, 14, 16, 18, 20, 24, 30, 36, 48px

**Spacing:**
- Base unit: 4px
- Common: 8, 12, 16, 24, 32, 48, 64px

**Border Radius:**
- Small: 4px (buttons, inputs)
- Medium: 8px (cards)
- Large: 12px (modals)
- Full: 9999px (avatars, badges)

**Shadows:**
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
```

#### H.3 Component Library
Using shadcn/ui with Tailwind CSS:
- Button (primary, secondary, outline, ghost)
- Input, Select, Checkbox
- Card, Dialog, Sheet
- Table with sorting/filtering
- Tabs, Accordion
- Toast notifications
- Badge, Avatar
- Progress, Skeleton
- Command palette (admin search)

#### H.4 Layout

**AppShell:**
```
┌─────────────────────────────────────────────┐
│  Logo    [Navigation]          [User Menu]  │
├──────────┬──────────────────────────────────┤
│          │                                  │
│  Sidebar │         Main Content             │
│  (role-  │                                  │
│  based)  │                                  │
│          │                                  │
├──────────┴──────────────────────────────────┤
│  Footer                                     │
└─────────────────────────────────────────────┘
```

**Sidebar by Role:**

Student:
- Dashboard
- Submit Forecast
- My Scores
- Leaderboards
- Settings

Supervisor:
- Dashboard
- My Teams
- Team Roster
- Reports
- Leaderboards
- Settings

Admin:
- Dashboard
- Season Management
- Markets
- Rounds
- Users
- Teams
- Actuals
- Scoring
- Reports
- Settings

#### H.5 Hero Screens

**1. Submission Grid (Student)**
```
┌────────────────────────────────────────────────┐
│  Round 3 Submission                            │
│  Deadline: Oct 22, 2025 11:59 PM ET  [2d 5h]  │
├────────────────────────────────────────────────┤
│                                                │
│  Nashville CBD                                 │
│  ┌──────────────────┬──────────────────┐      │
│  │  Week 42 (Oct 14)│  Week 43 (Oct 21)│      │
│  ├──────────────────┼──────────────────┤      │
│  │  Occupancy [___] │  Occupancy [___] │      │
│  │  ADR       [___] │  ADR       [___] │      │
│  └──────────────────┴──────────────────┘      │
│                                                │
│  Dubai                                         │
│  ┌──────────────────┬──────────────────┐      │
│  │  Week 42         │  Week 43         │      │
│  │  ...             │  ...             │      │
│                                                │
│  Hamburg                                       │
│  ┌──────────────────┬──────────────────┐      │
│  │  ...             │  ...             │      │
│                                                │
│               [Submit Forecast]                │
│                                                │
│  ⚠ Once submitted, your forecast is LOCKED   │
└────────────────────────────────────────────────┘
```

**2. Admin Control Center**
```
┌────────────────────────────────────────────────┐
│  Admin Dashboard - Fall 2025                   │
├────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Teams  │  │Submitted│  │ Pending │        │
│  │   92    │  │   78    │  │   14    │        │
│  └─────────┘  └─────────┘  └─────────┘        │
├────────────────────────────────────────────────┤
│  Current Round: 3       Status: OPEN          │
│  Closes: Oct 22, 11:59 PM ET                  │
│                                                │
│  Actions:                                      │
│  [Upload Actuals]  [Run Scoring]  [Warnings]  │
│                                                │
├────────────────────────────────────────────────┤
│  Recent Activity                               │
│  • Team "DataDawgs" submitted (2 min ago)     │
│  • Actuals R2 uploaded (1 hr ago)             │
│  • Scoring R2 completed (1 hr ago)            │
└────────────────────────────────────────────────┘
```

**3. Leaderboard**
```
┌────────────────────────────────────────────────┐
│  Leaderboard                                   │
│  [Occupancy] [ADR] [Combined]                 │
│                                                │
│  Filters: [All Markets ▼] [Cumulative ▼]      │
│           [All Universities ▼]                │
├────────────────────────────────────────────────┤
│  Rank  Team             University      MAE   │
│  ──────────────────────────────────────────── │
│  🥇 1   DataDawgs       U of Georgia   2.34  │
│  🥈 2   HMGT            Texas A&M      2.67  │
│  🥉 3   Suite Success   U of Delaware  3.01  │
│     4   Team STRong     EHL            3.15  │
│     5   Forecast Fight  Christ Univ    3.22  │
│     ...                                       │
│  ──────────────────────────────────────────── │
│  Your Team: Rank #12 (MAE: 4.56)             │
└────────────────────────────────────────────────┘
```

#### H.6 States

**Empty States:**
- No teams yet: "Create your first team to get started"
- No submissions: "Submit your forecast for Round X"
- No scores yet: "Scores will appear after the round closes"

**Loading States:**
- Skeleton loaders for tables and cards
- Spinner for form submissions

**Error States:**
- Inline validation errors below inputs
- Toast for API errors
- Full-page error for critical failures

---

### I) Acceptance Criteria

#### Must-Have Behaviors

**Registration & Auth:**
- [ ] User can register with email and password
- [ ] Email verification before access
- [ ] Login redirects to role-appropriate dashboard
- [ ] Password reset works via email

**Team Management:**
- [ ] Supervisor can create up to 10 teams
- [ ] Supervisor can add up to 5 students per team
- [ ] Supervisor must designate exactly 1 submitter per team
- [ ] Students can only be added by email if already registered

**Submissions:**
- [ ] Submitter sees correct form for current round
- [ ] Deadline is displayed in ET timezone
- [ ] Submission is blocked after deadline
- [ ] Submission is locked immediately after submit
- [ ] Submitter cannot edit locked submission
- [ ] 3 markets × 2 metrics × 2 weeks = 12 fields for R1-R6
- [ ] 3 markets × 2 metrics × 1 week = 6 fields for R7

**Scoring:**
- [ ] AE = |prediction - actual| calculated correctly
- [ ] MAE = mean of AE values
- [ ] Leaderboard shows ascending MAE order
- [ ] Scores update atomically after scoring job

**Warnings:**
- [ ] Teams without submission after deadline get warning
- [ ] Team with 3+ warnings is auto-disqualified
- [ ] Disqualified teams cannot submit

**Admin:**
- [ ] Admin can create/configure season
- [ ] Admin can set exactly 3 markets
- [ ] Admin can upload actuals (CSV)
- [ ] Admin can trigger scoring job
- [ ] Admin can disqualify/reinstate teams

---

### J) Milestones & Delivery Plan

#### MVP Scope (6 weeks)
1. User registration and authentication
2. Role-based access (Student, Supervisor, Admin)
3. Team creation and roster management
4. Round schedule display
5. Basic submission form (no validation)
6. Deadline enforcement
7. Submission locking
8. Actuals upload (admin)
9. Basic scoring engine
10. Simple leaderboard
11. Admin dashboard (basic)

#### V1 Scope (+4 weeks)
1. Email notifications
2. In-app notifications
3. Warnings automation
4. Disqualification logic
5. Report generation (PDF)
6. Advanced leaderboard filters
7. University-level rankings
8. Audit logging
9. Data export

#### Future Scope
1. Historical season archives
2. Advanced analytics dashboard
3. API for external integrations
4. Mobile-optimized experience
5. Multi-season comparison

#### Timeline

| Week | Milestone |
|------|-----------|
| 1 | Project setup, auth, database |
| 2 | Team management, roles |
| 3 | Submission system, deadlines |
| 4 | Actuals ingestion, scoring |
| 5 | Leaderboards, admin dashboard |
| 6 | Testing, bug fixes, polish |

#### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Deadline timing edge cases | Extensive timezone testing |
| Scoring accuracy | Unit tests for all calculations |
| Data integrity | Transaction isolation, constraints |
| Performance at scale | Load testing before launch |
| User adoption | Clear onboarding, help docs |

---

## PHASE 3: UI Design Specification

See detailed component and page specifications above in Section H.

### Additional UI Specifications

#### Page Inventory

**Public Pages:**
- Landing page (/)
- Login (/login)
- Register (/register)
- Password reset (/reset-password)

**Student Pages:**
- Dashboard (/dashboard)
- Submit Forecast (/submit)
- My Scores (/scores)
- Leaderboards (/leaderboards)
- Profile Settings (/settings)

**Supervisor Pages:**
- Dashboard (/dashboard)
- My Teams (/teams)
- Team Details (/teams/:id)
- Add Team Members (/teams/:id/members)
- Reports (/reports)
- Leaderboards (/leaderboards)
- Settings (/settings)

**Admin Pages:**
- Dashboard (/admin)
- Season Management (/admin/seasons)
- Season Details (/admin/seasons/:id)
- Markets (/admin/markets)
- Rounds (/admin/rounds)
- Users (/admin/users)
- All Teams (/admin/teams)
- Upload Actuals (/admin/actuals)
- Scoring Jobs (/admin/scoring)
- Reports (/admin/reports)
- Settings (/admin/settings)

---

## PHASE 4: Implementation Plan

### Architecture Choice

**Recommendation: Next.js 14 App Router (Fullstack)**

**Justification:**
1. Single codebase for frontend and backend
2. Server Components for optimal performance
3. API routes for backend logic
4. Built-in authentication support (NextAuth.js)
5. Deployment simplicity across hosting platforms
6. TypeScript end-to-end

### Folder Structure

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   └── reset-password/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # AppShell with sidebar
│   │   ├── dashboard/          # Role-based dashboard
│   │   ├── submit/             # Student submission
│   │   ├── scores/             # Student scores
│   │   ├── leaderboards/       # Public leaderboards
│   │   ├── teams/              # Supervisor teams
│   │   └── settings/           # User settings
│   ├── admin/
│   │   ├── layout.tsx          # Admin layout
│   │   ├── page.tsx            # Admin dashboard
│   │   ├── seasons/
│   │   ├── users/
│   │   ├── teams/
│   │   ├── actuals/
│   │   └── scoring/
│   ├── api/
│   │   ├── auth/
│   │   ├── teams/
│   │   ├── submissions/
│   │   ├── leaderboards/
│   │   └── admin/
│   ├── layout.tsx
│   └── page.tsx                # Landing page
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── forms/
│   ├── tables/
│   └── charts/
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── auth.ts                 # Auth utilities
│   ├── validations/            # Zod schemas
│   └── utils.ts
├── prisma/
│   └── schema.prisma
├── public/
└── types/
```

### Database Schema (Prisma)
See Section E above for complete schema.

### Job System Plan

**Background Jobs (using node-cron or Vercel Cron):**

1. **Warnings Job**
   - Trigger: After each round closes (scheduled)
   - Logic: Find teams without submissions, create warnings
   - Disqualify teams with 3+ warnings

2. **Scoring Job**
   - Trigger: Manual by admin after actuals uploaded
   - Logic: Match submissions to actuals, calculate AE
   - Update Score records, refresh leaderboard cache

3. **Notification Job**
   - Trigger: After scoring completes
   - Logic: Send emails to all participants

### Testing Plan

1. **Unit Tests:**
   - Scoring calculations
   - Deadline logic
   - Constraint validations

2. **Integration Tests:**
   - API endpoints
   - Database operations

3. **E2E Tests (Playwright):**
   - Registration flow
   - Submission flow
   - Admin workflows

---

## End of Document

This PRD is ready for implementation. Proceed to Phase 5: Building the MVP.
