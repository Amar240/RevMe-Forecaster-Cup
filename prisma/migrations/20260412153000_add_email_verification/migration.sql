ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "EmailVerificationCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailVerificationCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmailVerificationCode_userId_idx"
  ON "EmailVerificationCode"("userId");

CREATE INDEX IF NOT EXISTS "EmailVerificationCode_expiresAt_idx"
  ON "EmailVerificationCode"("expiresAt");

UPDATE "User"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt", CURRENT_TIMESTAMP)
WHERE "emailVerified" = TRUE
  AND "emailVerifiedAt" IS NULL;

UPDATE "User"
SET "emailVerified" = TRUE,
    "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP)
WHERE "role" IN ('ADMIN', 'SUB_ADMIN');
