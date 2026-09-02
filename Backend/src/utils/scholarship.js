/**
 * Calculate fee breakdown considering scholarship/discount for a student.
 *
 * @param {Object} student - Student object with class and scholarship fields
 * @param {number} [optExpected=0] - Total expected optional fees for the term
 * @returns {Object} Fee breakdown including discounts, expected fees, and totals
 */
export function calculateStudentFeeBreakdown(student, optExpected = 0) {
  const baseSchoolFee = Number(student?.class?.feeAmount || student?.classFee || student?.feeAmount || 0);
  const optionalFees = Number(optExpected || 0);

  const hasScholarship = Boolean(student?.hasScholarship && Number(student?.scholarshipValue || 0) > 0);
  const scholarshipType = student?.scholarshipType || "PERCENTAGE"; // "PERCENTAGE" | "FIXED_AMOUNT"
  const scholarshipTarget = student?.scholarshipTarget || "TUITION"; // "TUITION" | "TOTAL"
  const scholarshipValue = Number(student?.scholarshipValue || 0);
  const scholarshipReason = student?.scholarshipReason || null;

  let schoolFeeDiscount = 0;
  let optFeeDiscount = 0;

  if (hasScholarship) {
    if (scholarshipTarget === "TOTAL") {
      const totalBase = baseSchoolFee + optionalFees;
      if (scholarshipType === "PERCENTAGE") {
        const pct = Math.min(100, Math.max(0, scholarshipValue)) / 100;
        schoolFeeDiscount = Math.round(baseSchoolFee * pct);
        optFeeDiscount = Math.round(optionalFees * pct);
      } else {
        // FIXED_AMOUNT applied to total (absorb from tuition first, then optional)
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
