/*
  Warnings:

  - You are about to drop the column `TotalScore` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `examScore` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `testScore` on the `Result` table. All the data in the column will be lost.
  - Added the required column `score` to the `Result` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Result" DROP COLUMN "TotalScore",
DROP COLUMN "examScore",
DROP COLUMN "testScore",
ADD COLUMN     "score" DOUBLE PRECISION NOT NULL;
