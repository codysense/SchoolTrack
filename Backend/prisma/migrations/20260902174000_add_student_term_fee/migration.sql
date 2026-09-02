-- CreateTable
CREATE TABLE IF NOT EXISTS "StudentTermFee" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "StudentTermFee_studentId_termId_key" ON "StudentTermFee"("studentId", "termId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentTermFee_studentId_fkey'
    ) THEN
        ALTER TABLE "StudentTermFee" ADD CONSTRAINT "StudentTermFee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentTermFee_termId_fkey'
    ) THEN
        ALTER TABLE "StudentTermFee" ADD CONSTRAINT "StudentTermFee_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
