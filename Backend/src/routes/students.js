import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, adminOnly, staffOnly } from "../middleware/auth.js";
import { log } from "../services/audit.service.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

async function generateAdmissionNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.student.count();
  return `SCH/${year}/${String(count + 1).padStart(4, "0")}`;
}

// GET all students
router.get("/", staffOnly, async (req, res) => {
  const { classId, termId, includeInactive } = req.query;

  // Teachers only see their assigned class
  let filterClassId = classId;
  if (req.user.role === "TEACHER" && req.user.teacher?.classId) {
    filterClassId = req.user.teacher.classId;
  }

  const students = await prisma.student.findMany({
    where: {
      ...(filterClassId && { classId: filterClassId }),
      ...(!includeInactive && { isActive: true }),
    },
    include: {
      class: true,
      payments: termId ? { where: { termId } } : true,
      optionalFeeAssigns: termId
        ? { where: { termId }, include: { optionalFee: true, payments: true } }
        : { include: { optionalFee: true, payments: true } },
    },
    orderBy: { name: "asc" },
  });

  const data = students.map((s) => {
    const schoolPaid = s.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const optExpected = s.optionalFeeAssigns.reduce(
      (sum, a) => sum + a.optionalFee.amount,
      0,
    );
    const optPaid = s.optionalFeeAssigns.reduce(
      (sum, a) => sum + a.payments.reduce((sp, p) => sp + p.amountPaid, 0),
      0,
    );
    const totalFee = s.class.feeAmount + optExpected;
    const totalPaid = schoolPaid + optPaid;
    return {
      ...s,
      schoolPaid,
      optPaid,
      totalPaid,
      totalFee,
      optExpected,
      balance: totalFee - totalPaid,
    };
  });

  res.json(data);
});

// GET single student
router.get("/:id", staffOnly, async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: {
      class: true,
      payments: {
        orderBy: { date: "desc" },
        include: { term: { include: { session: true } } },
      },
      optionalFeeAssigns: {
        include: {
          optionalFee: true,
          payments: true,
          term: { include: { session: true } },
        },
      },
    },
  });
  if (!student) return res.status(404).json({ error: "Not found" });

  const schoolPaid = student.payments.reduce((s, p) => s + p.amountPaid, 0);
  const optExpected = student.optionalFeeAssigns.reduce(
    (s, a) => s + a.optionalFee.amount,
    0,
  );
  const optPaid = student.optionalFeeAssigns.reduce(
    (s, a) => s + a.payments.reduce((sp, p) => sp + p.amountPaid, 0),
    0,
  );
  const totalFee = student.class.feeAmount + optExpected;
  const totalPaid = schoolPaid + optPaid;

  res.json({
    ...student,
    schoolPaid,
    optPaid,
    totalPaid,
    totalFee,
    optExpected,
    balance: totalFee - totalPaid,
  });
});
//Get Student payment (including optional fees) history for a term
router.get("/:id/payments", staffOnly, async (req, res) => {
  const { termId } = req.query;
  const payments = await prisma.payment.findMany({
    where: {
      studentId: req.params.id,
      ...(termId && { termId }),
    },
    include: { term: { include: { session: true } } },
    orderBy: { date: "desc" },
  });
  const optPayments = await prisma.optionalFeePayment.findMany({
    where: {
      studentId: req.params.id,
      ...(termId && { optionalFeeAssign: { termId } }),
    },
    include: {
      optionalFeeAssign: {
        include: { optionalFee: true, term: { include: { session: true } } },
      },
    },
    orderBy: { date: "desc" },
  });

  //Get optional fees assigned to the student for the term
  const optFees = await prisma.optionalFeeAssign.findMany({
    where: {
      studentId: req.params.id,
      ...(termId && { termId }),
    },
    include: { optionalFee: true },
  });

  //Get total Optional fees assigned to the student for the term
  const optFeeExpected = optFees.reduce((s, a) => s + a.optionalFee.amount, 0);

  //Get optional fees paid  for the student for the term
  const optFeePaid = optPayments.reduce((s, p) => s + p.amountPaid, 0);

  const optFeeBalance = optFeeExpected - optFeePaid;

  res.json({
    payments,
    optPayments,
    optFeeExpected,
    optFeePaid,
    optFeeBalance,
  });
});

// POST create student
router.post("/", adminOnly, async (req, res) => {
  let { name, parentPhone, classId, admissionNumber } = req.body;
  if (!admissionNumber?.trim())
    admissionNumber = await generateAdmissionNumber();

  try {
    const student = await prisma.student.create({
      data: {
        admissionNumber: admissionNumber.trim(),
        name,
        parentPhone,
        classId,
      },
      include: { class: true },
    });
    await log({
      req,
      action: "CREATE",
      entity: "Student",
      entityId: student.id,
      detail: `Registered student "${student.name}" (${student.admissionNumber}) in ${student.class.className}`,
    });
    res.status(201).json(student);
  } catch (e) {
    if (e.code === "P2002")
      return res.status(409).json({ error: "Admission number already exists" });
    throw e;
  }
});

// PUT update student
router.put("/:id", adminOnly, async (req, res) => {
  const { name, parentPhone, classId, admissionNumber, isActive } = req.body;
  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: {
      name,
      parentPhone,
      classId,
      admissionNumber,
      ...(isActive !== undefined && { isActive }),
    },
    include: { class: true },
  });
  await log({
    req,
    action: "UPDATE",
    entity: "Student",
    entityId: student.id,
    detail: `Updated student "${student.name}"`,
  });
  res.json(student);
});

// DELETE student
router.delete("/:id", adminOnly, async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
  });
  await prisma.student.delete({ where: { id: req.params.id } });
  await log({
    req,
    action: "DELETE",
    entity: "Student",
    entityId: req.params.id,
    detail: `Deleted student "${student?.name}"`,
  });
  res.json({ success: true });
});

export default router;
