/**
 * Calculate fee breakdown considering scholarship/discount for a student.
 *
 * @param {Object} student - Student object with class and scholarship fields
 * @param {number} [optExpected=0] - Total expected optional fees for the term
 * @returns {Object} Fee breakdown including discounts, expected fees, and totals
 */
export function calculateStudentFeeBreakdown(student, optExpected = 0, termSnapshot = null) {
  const snapshot = termSnapshot || student?.termSnapshot || null;

  const baseSchoolFee = snapshot
    ? Number(snapshot.baseSchoolFee ?? 0)
    : Number(student?.class?.feeAmount || student?.classFee || student?.feeAmount || student?.schoolFee || 0);
  const optionalFees = Number(optExpected || student?.optExpected || 0);

  const hasScholarship = snapshot
    ? Boolean(snapshot.hasScholarship && Number(snapshot.scholarshipValue || 0) > 0)
    : Boolean(student?.hasScholarship && Number(student?.scholarshipValue || 0) > 0);

  const scholarshipType = snapshot ? (snapshot.scholarshipType || "PERCENTAGE") : (student?.scholarshipType || "PERCENTAGE");
  const scholarshipTarget = snapshot ? (snapshot.scholarshipTarget || "TUITION") : (student?.scholarshipTarget || "TUITION");
  const scholarshipValue = snapshot ? Number(snapshot.scholarshipValue || 0) : Number(student?.scholarshipValue || 0);
  const scholarshipReason = snapshot ? (snapshot.scholarshipReason || null) : (student?.scholarshipReason || null);

  let schoolFeeDiscount = 0;
  let optFeeDiscount = 0;

  if (hasScholarship) {
    if (scholarshipTarget === "TOTAL") {
      if (scholarshipType === "PERCENTAGE") {
        const pct = Math.min(100, Math.max(0, scholarshipValue)) / 100;
        schoolFeeDiscount = Math.round(baseSchoolFee * pct);
        optFeeDiscount = Math.round(optionalFees * pct);
      } else {
        const fixedVal = Math.max(0, scholarshipValue);
        schoolFeeDiscount = Math.min(baseSchoolFee, fixedVal);
        const remainder = Math.max(0, fixedVal - baseSchoolFee);
        optFeeDiscount = Math.min(optionalFees, remainder);
      }
    } else {
      // TUITION only
      if (scholarshipType === "PERCENTAGE") {
        const pct = Math.min(100, Math.max(0, scholarshipValue)) / 100;
        schoolFeeDiscount = Math.round(baseSchoolFee * pct);
      } else {
        const fixedVal = Math.max(0, scholarshipValue);
        schoolFeeDiscount = Math.min(baseSchoolFee, fixedVal);
      }
      optFeeDiscount = 0;
    }
  }

  const expectedSchoolFee = Math.max(0, baseSchoolFee - schoolFeeDiscount);
  const expectedOptFee = Math.max(0, optionalFees - optFeeDiscount);
  const totalDiscount = schoolFeeDiscount + optFeeDiscount;
  const totalExpectedFee = expectedSchoolFee + expectedOptFee;

  return {
    baseSchoolFee,
    baseOptFee: optionalFees,
    baseTotalFee: baseSchoolFee + optionalFees,
    hasScholarship,
    scholarshipType,
    scholarshipTarget,
    scholarshipValue,
    scholarshipReason,
    schoolFeeDiscount,
    optFeeDiscount,
    totalDiscount,
    expectedSchoolFee,
    expectedOptFee,
    totalExpectedFee,
  };
}

/**
 * Helper to get a human-readable scholarship label/badge text
 */
export function getScholarshipLabel(student) {
  if (!student?.hasScholarship || !student?.scholarshipValue) return null;
  const val = student.scholarshipType === "PERCENTAGE"
    ? `${student.scholarshipValue}%`
    : `₦${Number(student.scholarshipValue).toLocaleString()}`;
  const target = student.scholarshipTarget === "TOTAL" ? "Total Fee" : "Tuition";
  return `${val} ${target} Scholarship`;
}
