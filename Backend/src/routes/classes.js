import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate } from "../middleware/auth.js";
import { updateClassTermFee, getOrLockStudentTermFee } from "../utils/scholarship.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

// GET all classes (with student + subject counts)
router.get("/", async (_, res) => {
  const classes = await prisma.class.findMany({
    include: {
      _count: {
        select: {
          students: true,
          subjects: true,
        },
      },
    },
    orderBy: { className: "asc" },
  });
  res.json(classes);
});

// POST create a class
router.post("/", async (req, res) => {
  const { className, feeAmount } = req.body;
  try {
    const cls = await prisma.class.create({
      data: { className: className.trim(), feeAmount: parseFloat(feeAmount) },
    });
    res.status(201).json(cls);
  } catch (e) {
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A class with this name already exists" });
    }
    throw e;
  }
});

// PUT update a class
router.put("/:id", async (req, res) => {
  const { className, feeAmount } = req.body;
  const newFee = parseFloat(feeAmount);

  try {
    const existingClass = await prisma.class.findUnique({
      where: { id: req.params.id },
      include: { students: true },
    });
    if (!existingClass) return res.status(404).json({ error: "Class not found" });

    const currentTerm = await prisma.term.findFirst({
      where: { isCurrent: true },
    });

    // 1. Lock/freeze past terms for students in this class at the old fee rate if missing
    if (existingClass.students.length > 0) {
      const pastTerms = await prisma.term.findMany({
        where: currentTerm ? { id: { not: currentTerm.id } } : {},
      });

      for (const term of pastTerms) {
        for (const student of existingClass.students) {
          // Check if student has any activity (payment, assign, result) in that past term
          const [hasPayment, hasAssign, hasResult, hasSTF] = await Promise.all([
            prisma.payment.findFirst({ where: { studentId: student.id, termId: term.id } }),
            prisma.optionalFeeAssign.findFirst({ where: { studentId: student.id, termId: term.id } }),
            prisma.result.findFirst({ where: { studentId: student.id, termId: term.id } }),
            prisma.studentTermFee.findUnique({ where: { studentId_termId: { studentId: student.id, termId: term.id } } }),
          ]);

          if ((hasPayment || hasAssign || hasResult) && !hasSTF) {
            await getOrLockStudentTermFee(prisma, student.id, term.id, {
              ...student,
              class: { ...existingClass, feeAmount: existingClass.feeAmount },
            }, existingClass.feeAmount);
          }
        }
      }
    }

    // 2. Update the class record
    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: { className: className.trim(), feeAmount: newFee },
    });

    // 3. Update snapshots for the CURRENT active term only
    if (currentTerm) {
      await updateClassTermFee(prisma, req.params.id, currentTerm.id, newFee);
    }

    res.json(cls);
  } catch (e) {
    if (e.code === "P2002") {
      return res
        .status(409)
        .json({ error: "A class with this name already exists" });
    }
    throw e;
  }
});

// DELETE a class
router.delete("/:id", async (req, res) => {
  try {
    await prisma.class.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    if (e.code === "P2003") {
      return res
        .status(400)
        .json({ error: "Cannot delete class with enrolled students" });
    }
    throw e;
  }
});

export default router;
