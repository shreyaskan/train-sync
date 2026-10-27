-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_planId_fkey";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "planId";

-- DropTable
DROP TABLE "Plan";
