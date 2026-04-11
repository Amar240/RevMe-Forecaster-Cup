-- CreateEnum
CREATE TYPE "ArchiveStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "SeasonArchive" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "status" "ArchiveStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "s3Bucket" TEXT,
    "s3Prefix" TEXT,
    "fileManifest" JSONB,
    "totalSizeBytes" INTEGER,
    "errorMessage" TEXT,
    "triggeredById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonArchive_seasonId_version_key" ON "SeasonArchive"("seasonId", "version");

-- CreateIndex
CREATE INDEX "SeasonArchive_seasonId_idx" ON "SeasonArchive"("seasonId");

-- AddForeignKey
ALTER TABLE "SeasonArchive" ADD CONSTRAINT "SeasonArchive_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonArchive" ADD CONSTRAINT "SeasonArchive_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
