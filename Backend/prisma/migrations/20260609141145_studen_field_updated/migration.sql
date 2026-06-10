/*
  Warnings:

  - You are about to drop the `SportHouse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_sportHouseId_fkey";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "sportHouse" TEXT;

-- DropTable
DROP TABLE "SportHouse";
