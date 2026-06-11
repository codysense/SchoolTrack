/*
  Warnings:

  - You are about to drop the column `testScore` on the `Result` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Result" DROP CONSTRAINT "Result_studentId_fkey";

-- AlterTable
ALTER TABLE "Result" DROP COLUMN "testScore",
ADD COLUMN     "assignmentScore" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "attendanceScore" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "ca1Score" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "ca2Score" DOUBLE PRECISION DEFAULT 0,
ALTER COLUMN "TotalScore" SET DEFAULT 0,
ALTER COLUMN "examScore" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "AttendanceSummary" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "schoolOpened" INTEGER NOT NULL DEFAULT 0,
    "present" INTEGER NOT NULL DEFAULT 0,
    "punctual" INTEGER NOT NULL DEFAULT 0,
    "sportsActivities" INTEGER NOT NULL DEFAULT 0,
    "otherActivities" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AttendanceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSummary_studentId_termId_key" ON "AttendanceSummary"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "AttendanceSummary" ADD CONSTRAINT "AttendanceSummary_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSummary" ADD CONSTRAINT "AttendanceSummary_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
