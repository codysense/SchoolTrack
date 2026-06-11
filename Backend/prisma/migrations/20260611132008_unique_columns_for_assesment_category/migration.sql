/*
  Warnings:

  - A unique constraint covering the columns `[name,type]` on the table `AssessmentCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AssessmentCategory_name_type_key" ON "AssessmentCategory"("name", "type");
