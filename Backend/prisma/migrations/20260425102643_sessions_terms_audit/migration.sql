/*
  Warnings:

  - You are about to drop the column `term` on the `OptionalFeeAssign` table. All the data in the column will be lost.
  - You are about to drop the column `term` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `term` on the `Result` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,optionalFeeId,termId]` on the table `OptionalFeeAssign` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentId,subjectId,termId]` on the table `Result` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `termId` to the `OptionalFeeAssign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `termId` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Made the column `admissionNumber` on table `Student` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "OptionalFeeAssign_studentId_optionalFeeId_term_key";

-- DropIndex
DROP INDEX "Result_studentId_subjectId_term_key";

-- AlterTable
ALTER TABLE "OptionalFeeAssign" DROP COLUMN "term",
ADD COLUMN     "termId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OptionalFeePayment" ADD COLUMN     "note" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "term",
ADD COLUMN     "note" TEXT,
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "termId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Result" DROP COLUMN "term",
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "termId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "admissionNumber" SET NOT NULL;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "userRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_name_key" ON "Session"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Term_sessionId_name_key" ON "Term"("sessionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "OptionalFeeAssign_studentId_optionalFeeId_termId_key" ON "OptionalFeeAssign"("studentId", "optionalFeeId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "Result_studentId_subjectId_termId_key" ON "Result"("studentId", "subjectId", "termId");

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionalFeeAssign" ADD CONSTRAINT "OptionalFeeAssign_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
