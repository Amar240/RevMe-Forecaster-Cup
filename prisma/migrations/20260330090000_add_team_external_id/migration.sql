ALTER TABLE "Team" ADD COLUMN "externalTeamId" TEXT;

CREATE INDEX "Team_externalTeamId_idx" ON "Team"("externalTeamId");

CREATE UNIQUE INDEX "Team_seasonId_externalTeamId_key" ON "Team"("seasonId", "externalTeamId");
