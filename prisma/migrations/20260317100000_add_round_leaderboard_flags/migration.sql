-- AlterTable
ALTER TABLE "Round"
ADD COLUMN "leaderboardVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "leaderboardReviewed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "participantsNotified" BOOLEAN NOT NULL DEFAULT false;
