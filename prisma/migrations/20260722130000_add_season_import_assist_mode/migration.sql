CREATE TYPE "ImportAssistMode" AS ENUM ('DISABLED', 'ON_DEMAND');

ALTER TABLE "Season"
ADD COLUMN "importAssistMode" "ImportAssistMode" NOT NULL DEFAULT 'DISABLED';
