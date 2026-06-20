-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_categoryId_fkey";

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssessmentCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
