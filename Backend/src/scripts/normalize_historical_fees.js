import { PrismaClient } from "@prisma/client";
import { calculateStudentFeeBreakdown, getOrLockStudentTermFee } from "../utils/scholarship.js";

const prisma = new PrismaClient();

export async function normalizeHistoricalFees() {
  console.log("Starting historical fee normalization...");

  // 1. Populate OptionalFeeAssign.amount for any legacy records
  const unpopulatedAssigns = await prisma.optionalFeeAssign.findMany({
    where: { amount: null },
    include: { optionalFee: true },
  });

  console.log(`Found ${unpopulatedAssigns.length} OptionalFeeAssign records to populate amount.`);
  for (const a of unpopulatedAssigns) {
    await prisma.optionalFeeAssign.update({
      where: { id: a.id },
      data: { amount: a.optionalFee.amount },
    });
  }

  // 2. Identify current and past terms
  const currentTerm = await prisma.term.findFirst({
    where: { isCurrent: true },
  });

  const allTerms = await prisma.term.findMany({
    include: { session: true },
  });

  const pastTerms = allTerms.filter(t => !t.isCurrent);
  console.log(`Found ${pastTerms.length} past terms and current term: ${currentTerm?.name} (${currentTerm?.id})`);

  // 3. For each student with past activity, ensure locked StudentTermFee
  const students = await prisma.student.findMany({
    include: {
      class: true,
      payments: { include: { term: true } },
      optionalFeeAssigns: { include: { term: true } },
      studentTermFees: true,
    },
  });

  let createdSnapshots = 0;

  for (const student of students) {
    if (!student.class) continue;

    // Collect distinct past termIds where this student has records
    const pastTermIds = new Set([
      ...student.payments.map(p => p.termId).filter(id => id && id !== currentTerm?.id),
      ...student.optionalFeeAssigns.map(a => a.termId).filter(id => id && id !== currentTerm?.id),
    ]);

    for (const termId of pastTermIds) {
      const existingSTF = student.studentTermFees.find(tf => tf.termId === termId);
      if (existingSTF) continue;

      // Determine historical fee:
      const termPayments = student.payments.filter(p => p.termId === termId);
      let baseFee = student.class.feeAmount;

      if (termPayments.length > 0) {
        const sumPaid = termPayments.reduce((s, p) => s + p.amountPaid, 0);
        const lastP = termPayments[termPayments.length - 1];
        if (lastP && lastP.currentBalance !== null && lastP.currentBalance !== undefined) {
          baseFee = sumPaid + Number(lastP.currentBalance);
        } else if (sumPaid > 0 && sumPaid <= baseFee) {
          // If sumPaid was paid for that term, use sumPaid or historical fee
          baseFee = sumPaid;
        }
      }

      await getOrLockStudentTermFee(prisma, student.id, termId, student, baseFee);
      createdSnapshots++;
      console.log(`Locked snapshot for student ${student.name} in past term ${termId} with baseFee=₦${baseFee}`);
    }
  }

  console.log(`Normalization complete! Created ${createdSnapshots} historical snapshots.`);
}

normalizeHistoricalFees()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
