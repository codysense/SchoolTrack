/*
  Warnings:

  - You are about to drop the column `score` on the `Result` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Result" DROP COLUMN "score",
ADD COLUMN     "TotalScore" DOUBLE PRECISION,
ADD COLUMN     "examScore" DOUBLE PRECISION,
ADD COLUMN     "testScore" DOUBLE PRECISION;
