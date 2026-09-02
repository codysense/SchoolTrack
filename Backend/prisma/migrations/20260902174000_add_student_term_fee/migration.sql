-- CreateTable
CREATE TABLE "StudentTermFee" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "baseSchoolFee" DOUBLE PRECISION NOT NULL,
    "hasScholarship" BOOLEAN NOT NULL DEFAULT false,
    "scholarshipType" TEXT,
    "scholarshipValue" DOUBLE PRECISION,
    "scholarshipTarget" TEXT DEFAULT 'TUITION',
    "scholarshipReason" TEXT,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedSchoolFee" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTermFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentTermFee_studentId_termId_key" ON "StudentTermFee"("studentId", "termId");

-- AddForeignKey
ALTER TABLE "StudentTermFee" ADD CONSTRAINT "StudentTermFee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTermFee" ADD CONSTRAINT "StudentTermFee_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
