-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "hasScholarship" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scholarshipType" TEXT,
ADD COLUMN     "scholarshipValue" DOUBLE PRECISION,
ADD COLUMN     "scholarshipTarget" TEXT DEFAULT 'TUITION',
ADD COLUMN     "scholarshipReason" TEXT;
