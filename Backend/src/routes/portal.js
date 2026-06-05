import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, studentOnly } from "../middleware/auth.js";

const router = Router();
const prisma = new PrismaClient();

// Public: school info for portal header
router.get("/school-info", async (_, res) => {
  const school = await prisma.school.findFirst({
    select: {
      name: true,
      address: true,
      motto: true,
      logoUrl: true,
      phone: true,
    },
  });
  res.json(school || { name: "SchoolMgmt" });
});

router.use(authenticate, studentOnly);

function getGrade(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

function getRemark(score) {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Very Good";
  if (score >= 50) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}

async function computeStudentPosition({ classId, termId }) {
  // 1. Fetch all results for the class in a term
  const results = await prisma.result.findMany({
    where: {
      termId,
      student: {
        classId,
      },
    },
    select: {
      studentId: true,
      TotalScore: true,
    },
  });

  // 2. Aggregate totals per student
  const studentTotals = {};

  results.forEach((r) => {
    if (!studentTotals[r.studentId]) {
      studentTotals[r.studentId] = { total: 0, count: 0 };
    }

    studentTotals[r.studentId].total += r.TotalScore;
    studentTotals[r.studentId].count += 1;
  });

  // 3. Compute averages
  const studentAverages = Object.keys(studentTotals).map((studentId) => {
    const { total, count } = studentTotals[studentId];

    return {
      studentId,
      total,
      average: count ? total / count : 0,
    };
  });

  // 4. Sort by total (descending)
  studentAverages.sort((a, b) => b.total - a.total);

  // 5. Assign positions (with tie handling ✅)
  let currentPosition = 1;

  const ranked = studentAverages.map((student, index, arr) => {
    if (index > 0 && student.total < arr[index - 1].total) {
      currentPosition = index + 1;
    }

    return {
      ...student,
      position: currentPosition,
    };
  });

  return ranked;
}

async function computeSubjectPositions({ classId, termId }) {
  const results = await prisma.result.findMany({
    where: {
      termId,
      student: {
        classId,
      },
    },
    select: {
      studentId: true,
      subjectId: true,
      TotalScore: true,
    },
  });

  const subjectGroups = {};

  results.forEach((r) => {
    if (!subjectGroups[r.subjectId]) {
      subjectGroups[r.subjectId] = [];
    }
    subjectGroups[r.subjectId].push(r);
  });

  const subjectPositions = {};

  Object.keys(subjectGroups).forEach((subjectId) => {
    const list = subjectGroups[subjectId];

    // Sort descending
    list.sort((a, b) => b.TotalScore - a.TotalScore);

    let currentPosition = 1;

    subjectPositions[subjectId] = list.map((item, index, arr) => {
      if (index > 0 && item.TotalScore < arr[index - 1].TotalScore) {
        currentPosition = index + 1;
      }

      return {
        studentId: item.studentId,
        subjectId,
        totalScore: item.TotalScore,
        position: currentPosition,
      };
    });
  });

  return subjectPositions;
}

// GET /api/portal/me
router.get("/me", async (req, res) => {
  const student = await prisma.student.findUnique({
    where: { id: req.user.id },
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
  if (!student) return res.status(404).json({ error: "Student not found" });

  // Collect distinct termIds
  const termIdSet = new Set([
    ...student.payments.map((p) => p.termId),
    ...student.optionalFeeAssigns.map((a) => a.termId),
  ]);

  const terms = [];
  for (const termId of termIdSet) {
    const schoolPayments = student.payments.filter((p) => p.termId === termId);
    const schoolPaid = schoolPayments.reduce((s, p) => s + p.amountPaid, 0);
    const schoolFee = student.class.feeAmount;
    const schoolBalance = schoolFee - schoolPaid;

    const optAssigns = student.optionalFeeAssigns.filter(
      (a) => a.termId === termId,
    );
    const optExpected = optAssigns.reduce(
      (s, a) => s + a.optionalFee.amount,
      0,
    );
    const optPaid = optAssigns.reduce(
      (s, a) => s + a.payments.reduce((sp, p) => sp + p.amountPaid, 0),
      0,
    );
    const optBalance = optExpected - optPaid;

    const totalFee = schoolFee + optExpected;
    const totalPaid = schoolPaid + optPaid;
    const totalBalance = totalFee - totalPaid;

    // Get term label from first matching payment or assignment
    const termRef = schoolPayments[0]?.term || optAssigns[0]?.term;
    const termName = termRef?.name || "Unknown term";
    const sessionName = termRef?.session?.name || "";

    terms.push({
      termId,
      termName,
      sessionName,
      termLabel: `${sessionName} — ${termName}`,
      schoolFee,
      schoolPaid,
      schoolBalance,
      optExpected,
      optPaid,
      optBalance,
      totalFee,
      totalPaid,
      totalBalance,
      fullyPaid: totalBalance <= 0,
      schoolPayments: schoolPayments.map((p) => ({
        id: p.id,
        amountPaid: p.amountPaid,
        paymentMethod: p.paymentMethod,
        date: p.date,
        note: p.note,
      })),
      optAssigns: optAssigns.map((a) => ({
        id: a.id,
        name: a.optionalFee.name,
        amount: a.optionalFee.amount,
        paid: a.payments.reduce((s, p) => s + p.amountPaid, 0),
        balance:
          a.optionalFee.amount -
          a.payments.reduce((s, p) => s + p.amountPaid, 0),
      })),
    });
  }

  // Sort by session+term name
  terms.sort((a, b) => a.termLabel.localeCompare(b.termLabel));

  res.json({
    id: student.id,
    name: student.name,
    admissionNumber: student.admissionNumber,
    className: student.class.className,
    classId: student.classId,
    terms,
  });
});

// GET /api/portal/results?termId=…
router.get("/results", async (req, res) => {
  const { termId } = req.query;
  if (!termId) return res.status(400).json({ error: "termId is required" });

  const student = await prisma.student.findUnique({
    where: { id: req.user.id },
    include: {
      class: true,
      payments: { where: { termId } },
      optionalFeeAssigns: {
        where: { termId },
        include: { optionalFee: true, payments: true },
      },
    },
  });
  if (!student) return res.status(404).json({ error: "Student not found" });

  const schoolPaid = student.payments.reduce((s, p) => s + p.amountPaid, 0);
  const schoolFee = student.class.feeAmount;
  const optExpected = student.optionalFeeAssigns.reduce(
    (s, a) => s + a.optionalFee.amount,
    0,
  );
  const optPaid = student.optionalFeeAssigns.reduce(
    (s, a) => s + a.payments.reduce((sp, p) => sp + p.amountPaid, 0),
    0,
  );
  const totalBalance = schoolFee + optExpected - (schoolPaid + optPaid);
  const fullyPaid = totalBalance <= 0;

  // const results = await prisma.result.findMany({
  //   where: { studentId: req.user.id, termId },
  //   include: { subject: true },
  //   orderBy: { subject: { name: 'asc' } }
  // })

  try {
    // 1. Fetch student subject results
    const results = await prisma.result.findMany({
      where: {
        studentId: req.user.id,
        termId,
      },
      include: {
        subject: true,
      },
    });

    // if (!results.length) {
    //   const results = await prisma.subject.findMany({
    //     where: student.classId ? { classId: student.classId } : undefined,
    //     include: { class: true },
    //     orderBy: { name: "asc" },
    //   });

    // }

    // 2. Compute subject positions
    const subjectPositions = await computeSubjectPositions({
      classId: student.classId,
      termId,
    });

    // 3. Enrich subject results
    const enrichedResults = results.map((r) => {
      const subjectRankList = subjectPositions[r.subjectId] || [];

      const studentRank = subjectRankList.find(
        (s) => s.studentId === req.user.id,
      );

      return {
        subject: r.subject.name,
        testScore: r.testScore,
        examScore: r.examScore,
        TotalScore: r.TotalScore,
        grade: getGrade(r.TotalScore),
        subjectPosition: studentRank ? studentRank.position : null,
        remark: getRemark(r.TotalScore),
      };
    });

    //  4. Compute TOTAL + AVERAGE
    const totalScore = results.reduce((sum, r) => sum + r.TotalScore, 0);

    const average = results.length > 0 ? totalScore / results.length : 0;

    //  5. Final Grade
    const finalGrade = getGrade(average);

    //  6. Overall Position (reuse earlier function)
    const ranking = await computeStudentPosition({
      classId: student.classId,
      termId,
    });

    const studentRank = ranking.find((s) => s.studentId === req.user.id);

    //  7. Final Response
    res.json({
      studentId: req.user.id,
      termId,
      fullyPaid,
      totalBalance,
      canPrint: fullyPaid,
      summary: {
        totalScore,
        average: Number(average.toFixed(2)),
        finalGrade,
        position: studentRank ? studentRank.position : null,
      },

      subjects: enrichedResults,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch student result",
    });
  }

  // const scores  = results.map(r => r.score)
  // const total   = scores.reduce((a, b) => a + b, 0)
  // const average = scores.length ? total / scores.length : 0

  // res.json({
  //   fullyPaid,
  //   totalBalance,
  //   canPrint: fullyPaid,
  //   results: results.map(r => ({ ...r, grade: getGrade(r.score) })),
  //   summary: {
  //     total,
  //     average:      parseFloat(average.toFixed(2)),
  //     overallGrade: getGrade(average),
  //     count:        results.length
  //   }
  // })
});

export default router;
