-- Add nullable normalizedName first so existing staging data can be backfilled and merged safely.
ALTER TABLE "University" ADD COLUMN "normalizedName" TEXT;

CREATE INDEX "University_normalizedName_idx" ON "University"("normalizedName");
