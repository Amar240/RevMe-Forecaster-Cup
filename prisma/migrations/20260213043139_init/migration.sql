-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'SUPERVISOR', 'SUB_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'WAITING_ON_SUPERVISOR', 'WAITING_ON_STUDENT', 'ESCALATED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('LOGIN', 'SUBMISSION', 'SCORING', 'TEAM', 'GENERAL', 'PLATFORM', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "MessageVisibility" AS ENUM ('STUDENT_VISIBLE', 'INTERNAL_ONLY');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WarningType" AS ENUM ('MISSED_SUBMISSION', 'LATE_SUBMISSION', 'ADMIN_WARNING');

-- CreateEnum
CREATE TYPE "Metric" AS ENUM ('OCCUPANCY', 'ADR');

-- CreateEnum
CREATE TYPE "ScoringRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('SEASON', 'ROUND', 'MARKET_ROUND');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('UPCOMING', 'OPEN', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ActualSource" AS ENUM ('MANUAL', 'BULK');

-- CreateEnum
CREATE TYPE "ActualRevisionAction" AS ENUM ('CREATE', 'EDIT', 'VOID', 'UNVOID');

-- CreateEnum
CREATE TYPE "ResourceLinkType" AS ENUM ('REPORT', 'NEWS', 'DATA', 'MAP', 'DASHBOARD', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "rulesAcknowledgedAt" TIMESTAMP(3),
    "hasFullAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "universityId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "disqualifiedAt" TIMESTAMP(3),
    "disqualifiedReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "seasonId" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "isSubmitter" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "registrationOpen" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonMarket" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SeasonMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "seasonId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "status" "RoundStatus" NOT NULL DEFAULT 'UPCOMING',
    "isLockedActuals" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "scoresStale" BOOLEAN NOT NULL DEFAULT false,
    "lastScoredAt" TIMESTAMP(3),
    "lastScoredById" TEXT,
    "actualsVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "emailSentAt" TIMESTAMP(3),

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionValue" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "metric" "Metric" NOT NULL,
    "weekOffset" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SubmissionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actual" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "metric" "Metric" NOT NULL,
    "weekOffset" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" "ActualSource" NOT NULL DEFAULT 'MANUAL',
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Actual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualValueRevision" (
    "id" TEXT NOT NULL,
    "actualId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ActualRevisionAction" NOT NULL,
    "oldValue" DOUBLE PRECISION,
    "newValue" DOUBLE PRECISION,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActualValueRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionError" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "metric" "Metric" NOT NULL,
    "weekOffset" INTEGER NOT NULL,
    "predictedValue" DOUBLE PRECISION NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "absError" DOUBLE PRECISION NOT NULL,
    "apeError" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoringRunId" TEXT,

    CONSTRAINT "PredictionError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreAggregate" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "metric" "Metric" NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "roundId" TEXT,
    "marketId" TEXT,
    "mape" DOUBLE PRECISION NOT NULL,
    "nErrors" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoringRunId" TEXT,

    CONSTRAINT "ScoreAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRun" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "roundId" TEXT,
    "teamId" TEXT,
    "triggeredByAdminId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "ScoringRunStatus" NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,
    "submissionsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorsUpserted" INTEGER NOT NULL DEFAULT 0,
    "aggregatesUpserted" INTEGER NOT NULL DEFAULT 0,
    "actualsVersionAtRun" INTEGER,
    "summaryJson" JSONB,

    CONSTRAINT "ScoringRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warning" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "type" "WarningType" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDispatch" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientId" TEXT,
    "roundId" TEXT,
    "teamId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "EmailDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "studentId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "supervisorEmailEntered" TEXT,
    "teamId" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "createdById" TEXT NOT NULL,
    "teamId" TEXT,
    "supervisorId" TEXT,
    "assignedToId" TEXT,
    "category" "TicketCategory" NOT NULL DEFAULT 'GENERAL',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" JSONB,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "escalatedAt" TIMESTAMP(3),
    "escalatedById" TEXT,
    "escalationReason" TEXT,
    "autoEscalatedAt" TIMESTAMP(3),
    "supervisorLastResponseAt" TIMESTAMP(3),
    "feedbackRating" BOOLEAN,
    "feedbackSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketReply" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "visibility" "MessageVisibility" NOT NULL DEFAULT 'STUDENT_VISIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CannedResponse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL DEFAULT 'GENERAL',
    "createdById" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CannedResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketInfo" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "description" TEXT,
    "quickInsights" JSONB,
    "demandDrivers" TEXT[],
    "supplyNotes" TEXT[],
    "risks" TEXT[],
    "strategyHints" TEXT[],
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketResourceLink" (
    "id" TEXT NOT NULL,
    "marketInfoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "ResourceLinkType" NOT NULL DEFAULT 'OTHER',
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketResourceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketRoundUpdate" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "whatChanged" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketRoundUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "University_name_key" ON "University"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_displayId_key" ON "Team"("displayId");

-- CreateIndex
CREATE INDEX "Team_supervisorId_idx" ON "Team"("supervisorId");

-- CreateIndex
CREATE INDEX "Team_universityId_idx" ON "Team"("universityId");

-- CreateIndex
CREATE INDEX "Team_status_idx" ON "Team"("status");

-- CreateIndex
CREATE INDEX "Team_seasonId_idx" ON "Team"("seasonId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_teamId_key" ON "TeamMember"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Market_name_key" ON "Market"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMarket_seasonId_marketId_key" ON "SeasonMarket"("seasonId", "marketId");

-- CreateIndex
CREATE INDEX "Round_closesAt_idx" ON "Round"("closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "Round_seasonId_number_key" ON "Round"("seasonId", "number");

-- CreateIndex
CREATE INDEX "Submission_roundId_idx" ON "Submission"("roundId");

-- CreateIndex
CREATE INDEX "Submission_teamId_idx" ON "Submission"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_teamId_roundId_key" ON "Submission"("teamId", "roundId");

-- CreateIndex
CREATE INDEX "SubmissionValue_submissionId_idx" ON "SubmissionValue"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionValue_submissionId_marketId_metric_weekOffset_key" ON "SubmissionValue"("submissionId", "marketId", "metric", "weekOffset");

-- CreateIndex
CREATE INDEX "Actual_seasonId_marketId_metric_idx" ON "Actual"("seasonId", "marketId", "metric");

-- CreateIndex
CREATE INDEX "Actual_roundId_isVoided_idx" ON "Actual"("roundId", "isVoided");

-- CreateIndex
CREATE UNIQUE INDEX "Actual_seasonId_roundId_marketId_metric_weekOffset_key" ON "Actual"("seasonId", "roundId", "marketId", "metric", "weekOffset");

-- CreateIndex
CREATE INDEX "ActualValueRevision_actualId_idx" ON "ActualValueRevision"("actualId");

-- CreateIndex
CREATE INDEX "ActualValueRevision_actorId_idx" ON "ActualValueRevision"("actorId");

-- CreateIndex
CREATE INDEX "ActualValueRevision_createdAt_idx" ON "ActualValueRevision"("createdAt");

-- CreateIndex
CREATE INDEX "PredictionError_seasonId_teamId_idx" ON "PredictionError"("seasonId", "teamId");

-- CreateIndex
CREATE INDEX "PredictionError_scoringRunId_idx" ON "PredictionError"("scoringRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionError_seasonId_teamId_roundId_marketId_metric_wee_key" ON "PredictionError"("seasonId", "teamId", "roundId", "marketId", "metric", "weekOffset");

-- CreateIndex
CREATE INDEX "ScoreAggregate_seasonId_metric_scopeType_idx" ON "ScoreAggregate"("seasonId", "metric", "scopeType");

-- CreateIndex
CREATE INDEX "ScoreAggregate_scoringRunId_idx" ON "ScoreAggregate"("scoringRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreAggregate_seasonId_teamId_metric_scopeType_roundId_mar_key" ON "ScoreAggregate"("seasonId", "teamId", "metric", "scopeType", "roundId", "marketId");

-- CreateIndex
CREATE INDEX "ScoringRun_seasonId_idx" ON "ScoringRun"("seasonId");

-- CreateIndex
CREATE INDEX "ScoringRun_startedAt_idx" ON "ScoringRun"("startedAt");

-- CreateIndex
CREATE INDEX "Warning_teamId_idx" ON "Warning"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Warning_teamId_roundId_type_key" ON "Warning"("teamId", "roundId", "type");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "EmailDispatch_type_roundId_idx" ON "EmailDispatch"("type", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDispatch_type_recipientId_roundId_key" ON "EmailDispatch"("type", "recipientId", "roundId");

-- CreateIndex
CREATE INDEX "JoinRequest_studentId_idx" ON "JoinRequest"("studentId");

-- CreateIndex
CREATE INDEX "JoinRequest_supervisorId_idx" ON "JoinRequest"("supervisorId");

-- CreateIndex
CREATE INDEX "JoinRequest_status_idx" ON "JoinRequest"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_createdById_idx" ON "SupportTicket"("createdById");

-- CreateIndex
CREATE INDEX "SupportTicket_supervisorId_idx" ON "SupportTicket"("supervisorId");

-- CreateIndex
CREATE INDEX "SupportTicket_assignedToId_idx" ON "SupportTicket"("assignedToId");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicketReply_ticketId_idx" ON "SupportTicketReply"("ticketId");

-- CreateIndex
CREATE INDEX "CannedResponse_createdById_idx" ON "CannedResponse"("createdById");

-- CreateIndex
CREATE INDEX "CannedResponse_category_idx" ON "CannedResponse"("category");

-- CreateIndex
CREATE INDEX "MarketInfo_seasonId_idx" ON "MarketInfo"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketInfo_seasonId_marketId_key" ON "MarketInfo"("seasonId", "marketId");

-- CreateIndex
CREATE INDEX "MarketResourceLink_marketInfoId_idx" ON "MarketResourceLink"("marketInfoId");

-- CreateIndex
CREATE INDEX "MarketRoundUpdate_seasonId_marketId_idx" ON "MarketRoundUpdate"("seasonId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketRoundUpdate_seasonId_marketId_roundNumber_key" ON "MarketRoundUpdate"("seasonId", "marketId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_permissionId_key" ON "UserPermission"("userId", "permissionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMarket" ADD CONSTRAINT "SeasonMarket_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMarket" ADD CONSTRAINT "SeasonMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_lastScoredById_fkey" FOREIGN KEY ("lastScoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionValue" ADD CONSTRAINT "SubmissionValue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionValue" ADD CONSTRAINT "SubmissionValue_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actual" ADD CONSTRAINT "Actual_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualValueRevision" ADD CONSTRAINT "ActualValueRevision_actualId_fkey" FOREIGN KEY ("actualId") REFERENCES "Actual"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualValueRevision" ADD CONSTRAINT "ActualValueRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionError" ADD CONSTRAINT "PredictionError_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionError" ADD CONSTRAINT "PredictionError_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionError" ADD CONSTRAINT "PredictionError_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionError" ADD CONSTRAINT "PredictionError_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAggregate" ADD CONSTRAINT "ScoreAggregate_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAggregate" ADD CONSTRAINT "ScoreAggregate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAggregate" ADD CONSTRAINT "ScoreAggregate_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAggregate" ADD CONSTRAINT "ScoreAggregate_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRun" ADD CONSTRAINT "ScoringRun_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRun" ADD CONSTRAINT "ScoringRun_triggeredByAdminId_fkey" FOREIGN KEY ("triggeredByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warning" ADD CONSTRAINT "Warning_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketReply" ADD CONSTRAINT "SupportTicketReply_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketReply" ADD CONSTRAINT "SupportTicketReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CannedResponse" ADD CONSTRAINT "CannedResponse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketInfo" ADD CONSTRAINT "MarketInfo_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketInfo" ADD CONSTRAINT "MarketInfo_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketInfo" ADD CONSTRAINT "MarketInfo_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketResourceLink" ADD CONSTRAINT "MarketResourceLink_marketInfoId_fkey" FOREIGN KEY ("marketInfoId") REFERENCES "MarketInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRoundUpdate" ADD CONSTRAINT "MarketRoundUpdate_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRoundUpdate" ADD CONSTRAINT "MarketRoundUpdate_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRoundUpdate" ADD CONSTRAINT "MarketRoundUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
