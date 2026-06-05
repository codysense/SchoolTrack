import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, staffOnly, adminOnly } from "../middleware/auth.js";
import { log } from "../services/audit.service.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

function getGrade(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
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

function getRemark(score) {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Very Good";
  if (score >= 50) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}

// async function computeSubjectPositions({ classId, termId }) {
//   const results = await prisma.result.findMany({
//     where: {
//       termId,
//       student: {
//         classId,
//       },
//     },
//     select: {
//       studentId: true,
//       subjectId: true,
//       TotalScore: true,
//     },
//   });

//   // console.log(
//   //   "Fetched results for subject positions and result object:",
//   //   results.length,
//   //   results,
//   // );

//   // Group by subject
//   const subjectGroups = {};

//   results.forEach((r) => {
//     if (!subjectGroups[r.subjectId]) {
//       subjectGroups[r.subjectId] = [];
//     }

//     subjectGroups[r.subjectId].push(r);
//   });

//   const subjectPositions = {};

//   // Compute ranking per subject
//   Object.keys(subjectGroups).forEach((subjectId) => {
//     const list = subjectGroups[subjectId];

//     // Sort descending
//     list.sort((a, b) => b.TotalScore - a.TotalScore);

//     let currentPosition = 1;

//     subjectPositions[subjectId] = list.map((item, index, arr) => {
//       if (index > 0 && item.totalScore < arr[index - 1].totalScore) {
//         currentPosition = index + 1;
//       }

//       return {
//         studentId: item.studentId,
//         subjectId,
//         totalScore: item.totalScore,
//         position: currentPosition,
//       };
//     });
//   });

//   return subjectPositions;
// }

// Subjects

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

router.get("/subjects", staffOnly, async (req, res) => {
  const { classId } = req.query;
  const subjects = await prisma.subject.findMany({
    where: classId ? { classId } : undefined,
    include: { class: true },
    orderBy: { name: "asc" },
  });
  res.json(subjects);
});

router.post("/subjects", staffOnly, async (req, res) => {
  const { name, classId } = req.body;
  try {
    const subject = await prisma.subject.create({
      data: { name: name.trim(), classId },
      include: { class: true },
    });
    await log({
      req,
      action: "CREATE",
      entity: "Subject",
      entityId: subject.id,
      detail: `Added subject "${subject.name}" to ${subject.class.className}`,
    });
    res.status(201).json(subject);
  } catch (e) {
    if (e.code === "P2002")
      return res
        .status(409)
        .json({ error: "Subject already exists in this class" });
    throw e;
  }
});

router.delete("/subjects/:id", staffOnly, async (req, res) => {
  const subject = await prisma.subject.findUnique({
    where: { id: req.params.id },
  });
  await prisma.result.deleteMany({ where: { subjectId: req.params.id } });
  await prisma.subject.delete({ where: { id: req.params.id } });
  await log({
    req,
    action: "DELETE",
    entity: "Subject",
    entityId: req.params.id,
    detail: `Deleted subject "${subject?.name}"`,
  });
  res.json({ success: true });
});

// GET results for a student for a term
router.get("/student-result/:studentId", async (req, res) => {
  const { studentId } = req.params;
  const { classId, termId } = req.query;

  if (!classId || !termId) {
    return res.status(400).json({
      error: "classId and termId are required",
    });
  }

  try {
    // 1. Fetch student subject results
    const results = await prisma.result.findMany({
      where: {
        studentId,
        termId,
      },
      include: {
        subject: true,
      },
    });

    if (!results.length) {
      const results = await prisma.subject.findMany({
        where: classId ? { classId } : undefined,
        include: { class: true },
        orderBy: { name: "asc" },
      });
      // res.json(subjects);
      // return res.status(404).json({
      //   error: "No results found for student",
      // });
    }

    // 2. Compute subject positions
    const subjectPositions = await computeSubjectPositions({
      classId,
      termId,
    });

    // 3. Enrich subject results
    const enrichedResults = results.map((r) => {
      const subjectRankList = subjectPositions[r.subjectId] || [];

      const studentRank = subjectRankList.find(
        (s) => s.studentId === studentId,
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
      classId,
      termId,
    });

    const studentRank = ranking.find((s) => s.studentId === studentId);

    //  7. Final Response
    res.json({
      studentId,
      termId,

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
});

// router.get("/student/:studentId", staffOnly, async (req, res) => {
//    const { studentId } = req.params;
//   const { classId, termId } = req.query
//  if (!classId || !termId) {
//     return res.status(400).json({
//       error: "classId and termId are required",
//     });
//   }

//   const results = await prisma.result.findMany({
//     where: { studentId: req.params.studentId, termId },
//     include: { subject: true },
//     orderBy: { subject: { name: "asc" } },
//   });

//   const scores = results.map((r) => r.score);
//   const total = scores.reduce((a, b) => a + b, 0);
//   const average = scores.length ? total / scores.length : 0;

//   res.json({
//     results: results.map((r) => ({ ...r, grade: getGrade(r.score) })),
//     total,
//     average: parseFloat(average.toFixed(2)),
//     overallGrade: getGrade(average),
//   });
// });

// POST upsert a score
router.post("/", staffOnly, async (req, res) => {
  const { studentId, termId, results } = req.body;

  if (!studentId || !termId || !Array.isArray(results)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    // Validate first BEFORE touching DB
    for (const item of results) {
      const { testScore = 0, examScore = 0 } = item;

      if (testScore > 30 || examScore > 70) {
        return res.status(400).json({
          error: `Invalid score range for subjectId: ${item.subjectId}`,
        });
      }
    }

    //  Build queries (NOT promises yet)
    const queries = results.map((item) => {
      const { subjectId, testScore = 0, examScore = 0 } = item;

      const totalScore = parseFloat(testScore) + parseFloat(examScore);

      return prisma.result.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId,
            subjectId,
            termId,
          },
        },
        update: {
          testScore: parseFloat(testScore),
          examScore: parseFloat(examScore),
          TotalScore: totalScore,
          recordedById: req.user.id,
        },
        create: {
          studentId,
          subjectId,
          termId,
          testScore: parseFloat(testScore),
          examScore: parseFloat(examScore),
          TotalScore: totalScore,
          recordedById: req.user.id,
        },
        include: {
          subject: true,
          student: true,
        },
      });
    });

    //  Transaction (ALL succeed or ALL fail)
    const savedResults = await prisma.$transaction(queries);

    //  Single log entry
    await log({
      req,
      action: "CREATE",
      entity: "Result",
      entityId: studentId,
      detail: `Recorded results for ${savedResults[0]?.student?.name}`,
      metadata: { studentId, termId, count: savedResults.length },
    });

    //  Add grade
    const response = savedResults.map((r) => ({
      ...r,
      grade: getGrade(r.totalScore),
    }));

    res.json(response);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to save results",
    });
  }
});
// router.post("/", staffOnly, async (req, res) => {
//   const { studentId, subjectId, termId, score } = req.body;
//   if (!termId) return res.status(400).json({ error: "termId is required" });

//   const result = await prisma.result.upsert({
//     where: { studentId_subjectId_termId: { studentId, subjectId, termId } },
//     update: { score: parseFloat(score), recordedById: req.user.id },
//     create: {
//       studentId,
//       subjectId,
//       termId,
//       score: parseFloat(score),
//       recordedById: req.user.id,
//     },
//     include: { subject: true, student: true },
//   });

//   await log({
//     req,
//     action: "CREATE",
//     entity: "Result",
//     entityId: result.id,
//     detail: `Recorded ${score} for ${result.student.name} — ${result.subject.name}`,
//     metadata: { studentId, subjectId, termId, score },
//   });

//   res.json({ ...result, grade: getGrade(result.score) });
// });

// DELETE a result entry
router.delete("/:id", staffOnly, async (req, res) => {
  const result = await prisma.result.findUnique({
    where: { id: req.params.id },
    include: { student: true, subject: true },
  });
  await prisma.result.delete({ where: { id: req.params.id } });
  await log({
    req,
    action: "DELETE",
    entity: "Result",
    entityId: req.params.id,
    detail: `Deleted result for ${result?.student.name} — ${result?.subject.name}`,
  });
  res.json({ success: true });
});

export default router;
