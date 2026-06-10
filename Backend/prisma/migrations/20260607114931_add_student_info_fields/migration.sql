-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "entryClass" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "genotype" TEXT,
ADD COLUMN     "height" DOUBLE PRECISION,
ADD COLUMN     "parentAddress" TEXT,
ADD COLUMN     "parentEmail" TEXT,
ADD COLUMN     "parentName" TEXT,
ADD COLUMN     "passportPhoto" TEXT,
ADD COLUMN     "sportHouseId" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "SportHouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "motto" TEXT,

    CONSTRAINT "SportHouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "AssessmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "score" TEXT,
    "remark" TEXT,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_studentId_termId_categoryId_key" ON "Assessment"("studentId", "termId", "categoryId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_sportHouseId_fkey" FOREIGN KEY ("sportHouseId") REFERENCES "SportHouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssessmentCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
