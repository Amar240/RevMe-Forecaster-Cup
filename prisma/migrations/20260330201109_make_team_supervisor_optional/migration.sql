-- DropForeignKey
ALTER TABLE "Team" DROP CONSTRAINT "Team_supervisorId_fkey";

-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "supervisorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
