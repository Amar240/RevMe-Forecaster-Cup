CREATE TYPE "ImportBatchRole" AS ENUM ('SUPERVISOR', 'ADMIN');
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEWED', 'CONFIRMED', 'COMPLETED');

CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "uploaderRole" "ImportBatchRole" NOT NULL,
    "seasonId" TEXT NOT NULL,
    "universityId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "s3Key" TEXT,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEWED',
    "summaryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Team" ADD COLUMN "importBatchId" TEXT;

CREATE INDEX "ImportBatch_uploaderId_idx" ON "ImportBatch"("uploaderId");
CREATE INDEX "ImportBatch_seasonId_idx" ON "ImportBatch"("seasonId");
CREATE INDEX "ImportBatch_universityId_idx" ON "ImportBatch"("universityId");
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");
CREATE INDEX "Team_importBatchId_idx" ON "Team"("importBatchId");
CREATE UNIQUE INDEX "EmailDispatch_type_recipientId_teamId_key" ON "EmailDispatch"("type", "recipientId", "teamId");

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
