/**
 * Calculate fee breakdown considering scholarship/discount for a student.
 * Supports historical termSnapshot locking.
 *
 * @param {Object} student - Student object with class and scholarship fields
 * @param {number} [optExpected=0] - Total expected optional fees for the term
 * @param {Object} [termSnapshot=null] - Optional historical StudentTermFee snapshot
 * @returns {Object} Fee breakdown including discounts, expected fees, and totals
 */
export function calculateStudentFeeBreakdown(student, optExpected = 0, termSnapshot = null) {
  const snapshot = termSnapshot || student?.termSnapshot || null;

  const baseSchoolFee = snapshot
    ? Number(snapshot.baseSchoolFee ?? 0)
    : Number(student?.class?.feeAmount || student?.classFee || student?.feeAmount || 0);
  const optionalFees = Number(optExpected || 0);

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
    isSnapshot: Boolean(snapshot),
  };
}

/**
 * Returns the effective amount for an optional fee assignment,
 * preferring the frozen assignment amount, falling back to fee template amount.
 */
export function getOptionalFeeAssignAmount(assign) {
  if (!assign) return 0;
  if (assign.amount !== null && assign.amount !== undefined) {
    return Number(assign.amount);
  }
  return Number(assign.optionalFee?.amount || 0);
}

/**
 * Retrieves the locked StudentTermFee snapshot for a student in a term,
 * or locks and creates one using student's current scholarship profile if not already locked.
 */
export async function getOrLockStudentTermFee(prisma, studentId, termId, student = null, customBaseFee = null) {
  if (!studentId || !termId) return null;

  // 1. Check if snapshot already exists
  const existing = await prisma.studentTermFee.findUnique({
    where: { studentId_termId: { studentId, termId } },
  });
  if (existing) return existing;

  // 2. Fetch student if not provided
  if (!student || !student.class) {
    student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });
  }
  if (!student || !student.class) return null;

  const baseSchoolFee = customBaseFee !== null ? Number(customBaseFee) : Number(student.class.feeAmount || 0);
  const breakdown = calculateStudentFeeBreakdown({ ...student, class: { ...student.class, feeAmount: baseSchoolFee } }, 0);

  const snapshot = await prisma.studentTermFee.create({
    data: {
      studentId,
      termId,
      baseSchoolFee,
      hasScholarship: breakdown.hasScholarship,
      scholarshipType: breakdown.hasScholarship ? breakdown.scholarshipType : null,
      scholarshipValue: breakdown.hasScholarship ? breakdown.scholarshipValue : null,
      scholarshipTarget: breakdown.hasScholarship ? breakdown.scholarshipTarget : "TUITION",
      scholarshipReason: breakdown.hasScholarship ? breakdown.scholarshipReason : null,
      discountAmount: breakdown.schoolFeeDiscount,
      expectedSchoolFee: breakdown.expectedSchoolFee,
    },
  });

  return snapshot;
}

/**
 * Seals/locks snapshots for all active students for a given term.
 */
export async function lockAllStudentsTermFee(prisma, termId) {
  if (!termId) return;

  const students = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    include: {
      class: true,
      studentTermFees: { where: { termId } },
    },
  });

  for (const s of students) {
    if (!s.class) continue;
    if (!s.studentTermFees || s.studentTermFees.length === 0) {
      await getOrLockStudentTermFee(prisma, s.id, termId, s);
    }
  }
}

/**
 * Updates or creates student term fee snapshots ONLY for a specific term (e.g. current term)
 * when a class fee changes, without touching past terms.
 */
export async function updateClassTermFee(prisma, classId, termId, newFeeAmount) {
  if (!classId || !termId) return;

  const students = await prisma.student.findMany({
    where: { classId, status: "ACTIVE" },
    include: { class: true, studentTermFees: { where: { termId } } },
  });

  for (const s of students) {
    const breakdown = calculateStudentFeeBreakdown(
      { ...s, class: { ...s.class, feeAmount: Number(newFeeAmount) } },
      0
    );

    await prisma.studentTermFee.upsert({
      where: { studentId_termId: { studentId: s.id, termId } },
      create: {
        studentId: s.id,
        termId,
        baseSchoolFee: Number(newFeeAmount),
        hasScholarship: breakdown.hasScholarship,
        scholarshipType: breakdown.hasScholarship ? breakdown.scholarshipType : null,
        scholarshipValue: breakdown.hasScholarship ? breakdown.scholarshipValue : null,
        scholarshipTarget: breakdown.hasScholarship ? breakdown.scholarshipTarget : "TUITION",
        scholarshipReason: breakdown.hasScholarship ? breakdown.scholarshipReason : null,
        discountAmount: breakdown.schoolFeeDiscount,
        expectedSchoolFee: breakdown.expectedSchoolFee,
      },
      update: {
        baseSchoolFee: Number(newFeeAmount),
        discountAmount: breakdown.schoolFeeDiscount,
        expectedSchoolFee: breakdown.expectedSchoolFee,
      },
    });
  }
}

