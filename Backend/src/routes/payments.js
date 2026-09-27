import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, adminOnly, staffOnly } from "../middleware/auth.js";
import { sendNotification } from "../services/notification.service.js";
import { log } from "../services/audit.service.js";
import { calculateStudentFeeBreakdown, getOrLockStudentTermFee } from "../utils/scholarship.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// ── Dashboard summary (term-aware) ────────────────────────────────────────────
router.get("/summary", staffOnly, async (req, res) => {
  // Use provided termId or fall back to the current term
  let { termId } = req.query;

  if (!termId) {
    const currentTerm = await prisma.term.findFirst({
      where: { isCurrent: true },
    });
    termId = currentTerm?.id;
  }

  if (!termId) {
    // No term set yet — return zeroed summary
    return res.json({
      termId: null,
      termName: null,
      sessionName: null,
      totalStudents: 0,
      schoolFeeExpected: 0,
      schoolFeeCollected: 0,
      schoolFeeOutstanding: 0,
      optFeeSummary: [],
      optFeeExpected: 0,
      optFeeCollected: 0,
      optFeeOutstanding: 0,
      totalExpected: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      recentPayments: [],
    });
  }

  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { session: true },
  });

  const [students, payments, optAssigns, recentPayments] = await Promise.all([
    prisma.student.findMany({
      where: { isActive: true },
      include: { class: true, studentTermFees: { where: { termId } } },
    }),
    prisma.payment.findMany({ where: { termId } }),
    prisma.optionalFeeAssign.findMany({
      where: { termId },
      include: { optionalFee: true, payments: true },
    }),
    prisma.payment.findMany({
      where: { termId },
      take: 10,
      orderBy: { date: "desc" },
      include: { student: { include: { class: true } } },
    }),
  ]);

  const schoolFeeExpected = students.reduce((s, st) => {
    const termSnapshot = st.studentTermFees?.[0] || null;
    const breakdown = calculateStudentFeeBreakdown(st, 0, termSnapshot);
    return s + breakdown.expectedSchoolFee;
  }, 0);
  const schoolFeeCollected = payments.reduce((s, p) => s + p.amountPaid, 0);

  // Per-fee-type breakdown for individual dashboard cards
  const optFeeMap = {};
  for (const a of optAssigns) {
    const fid = a.optionalFeeId;
    if (!optFeeMap[fid]) {
      optFeeMap[fid] = {
        id: fid,
        name: a.optionalFee.name,
        description: a.optionalFee.description,
        expected: 0,
        collected: 0,
        outstanding: 0,
        assignCount: 0,
      };
    }
    const paid = a.payments.reduce((s, p) => s + p.amountPaid, 0);
    const feeAmt = a.amount !== null && a.amount !== undefined ? a.amount : a.optionalFee.amount;
    optFeeMap[fid].expected += feeAmt;
    optFeeMap[fid].collected += paid;
    optFeeMap[fid].outstanding += feeAmt - paid;
    optFeeMap[fid].assignCount += 1;
  }

  const optFeeSummary = Object.values(optFeeMap);
  const optFeeExpected = optFeeSummary.reduce((s, f) => s + f.expected, 0);
  const optFeeCollected = optFeeSummary.reduce((s, f) => s + f.collected, 0);

  res.json({
    termId,
    termName: term.name,
    sessionName: term.session.name,
    totalStudents: students.length,
    schoolFeeExpected,
    schoolFeeCollected,
    schoolFeeOutstanding: schoolFeeExpected - schoolFeeCollected,
    optFeeSummary,
    optFeeExpected,
    optFeeCollected,
    optFeeOutstanding: optFeeExpected - optFeeCollected,
    totalExpected: schoolFeeExpected + optFeeExpected,
    totalCollected: schoolFeeCollected + optFeeCollected,
    totalOutstanding:
      schoolFeeExpected +
      optFeeExpected -
      (schoolFeeCollected + optFeeCollected),
    recentPayments,
  });
});

// ── GET all payments (school-fee and optional) for a term ─────────────────────
router.get("/", staffOnly, async (req, res) => {
  const { termId, type, status } = req.query;

  let statusWhere = {};
  if (status && status.toUpperCase() !== "ALL") {
    statusWhere = { status: status.toUpperCase() };
  } else if (!status) {
    statusWhere = { status: "ACTIVE" };
  }

  const [tuitionPayments, optPayments] = await Promise.all([
    type === "optional"
      ? []
      : prisma.payment.findMany({
          where: {
            ...(termId ? { termId } : {}),
            ...(Object.keys(statusWhere).length ? { student: statusWhere } : {}),
          },
          include: {
            student: { include: { class: true } },
            term: { include: { session: true } },
          },
          orderBy: { date: "desc" },
          take: 300,
        }),
    type === "tuition"
      ? []
      : prisma.optionalFeePayment.findMany({
          where: {
            ...(termId ? { optionalFeeAssign: { termId } } : {}),
            ...(Object.keys(statusWhere).length ? { student: statusWhere } : {}),
          },
          include: {
            student: { include: { class: true } },
            optionalFeeAssign: {
              include: { optionalFee: true, term: { include: { session: true } } },
            },
          },
          orderBy: { date: "desc" },
          take: 300,
        }),
  ]);

  const formattedTuition = tuitionPayments.map((p) => ({
    ...p,
    paymentType: "TUITION",
    feeName: "Tuition / School Fees",
  }));

  const formattedOpt = optPayments.map((p) => ({
    id: p.id,
    studentId: p.studentId,
    student: p.student,
    termId: p.optionalFeeAssign?.termId,
    term: p.optionalFeeAssign?.term,
    amountPaid: p.amountPaid,
    paymentMethod: p.paymentMethod,
    note: p.note,
    date: p.date,
    createdAt: p.createdAt,
    paymentType: "OPTIONAL",
    feeName: p.optionalFeeAssign?.optionalFee?.name || "Optional Fee",
    optionalFeeAssign: p.optionalFeeAssign,
  }));

  const all = [...formattedTuition, ...formattedOpt].sort(
    (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt),
  );

  res.json(all);
});

// ── POST record a school-fee payment ─────────────────────────────────────────
router.post("/", adminOnly, async (req, res) => {
  const { studentId, termId, amountPaid, paymentMethod, note } = req.body;

  if (!termId) return res.status(400).json({ error: "termId is required" });
  if (!studentId)
    return res.status(400).json({ error: "studentId is required" });

  const recentPayment = await prisma.payment.findFirst({
    where: { studentId, termId },
    orderBy: { date: "desc" },
  });

  if (recentPayment && Date.now() - recentPayment.date.getTime() < 60 * 1000) {
    return res.status(400).json({
      error:
        "A payment was recorded for this student and term less than a minute ago. Please wait before recording another payment.",
    });
  }

  //Get current balance for the term
  const TermPayments = await prisma.payment.findMany({
    where: { studentId, termId },
  });
  const totalTermPaid = TermPayments.reduce((s, p) => s + p.amountPaid, 0);
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: true },
  });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const termSnapshot = await getOrLockStudentTermFee(prisma, studentId, termId, student);
  const breakdown = calculateStudentFeeBreakdown(student, 0, termSnapshot);
  const expectedSchoolFee = breakdown.expectedSchoolFee;
  const balance = expectedSchoolFee - totalTermPaid;

  if (amountPaid > balance) {
    return res.status(400).json({
      error: `Payment exceeds outstanding balance. Current balance for this term is ₦${balance.toFixed(2)}.`,
    });
  }

  const payment = await prisma.payment.create({
    data: {
      studentId,
      termId,
      amountPaid: parseFloat(amountPaid),
      paymentMethod,
      note: note || null,
      recordedById: req.user.id,
      currentBalance: balance - parseFloat(amountPaid),
    },
    include: {
      student: { include: { class: true } },
      term: { include: { session: true } },
    },
  });

  const allTermPayments = await prisma.payment.findMany({
    where: { studentId, termId },
  });
  const studentTermPayments = allTermPayments.reduce(
    (s, p) => s + p.amountPaid,
    0,
  );
  const studentTermBalance =
    expectedSchoolFee - studentTermPayments;
  const termLabel = `${payment.term.session.name} ${payment.term.name}`;

  await log({
    req,
    action: "CREATE",
    entity: "Payment",
    entityId: payment.id,
    detail: `Recorded ₦${amountPaid} school fee for ${payment.student.name} — ${termLabel}`,
    metadata: { studentId, termId, amountPaid, paymentMethod },
  });

  // sendNotification({
  //   phone:   payment.student.parentPhone,
  //   type:    'payment_confirmation',
  //   message: `Payment of ₦${Number(amountPaid).toLocaleString()} received for ${payment.student.name} (${termLabel} school fees). Balance: ₦${balance.toFixed(2)}.`
  // }).catch(console.error)

  res.status(201).json({ payment, totalTermPaid, balance });
});

export default router;
