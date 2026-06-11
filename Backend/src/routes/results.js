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

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    const currentTerm = await prisma.term.findUnique({
      where: { id: termId },
      include: {
        session: true,
      },
    });

    if (!currentTerm) {
      return res.status(404).json({
        error: "Term not found",
      });
    }

    const classSize = await prisma.student.count({
      where: {
        classId,
        isActive: true,
      },
    });

    const school = await prisma.school.findFirst();

    async function getPreviousTerms(termId) {
      const term = await prisma.term.findUnique({
        where: { id: termId },
        include: {
          session: {
            include: {
              terms: true,
            },
          },
        },
      });

      const orderedTerms = term.session.terms.sort((a, b) => {
        const order = {
          "First Term": 1,
          "Second Term": 2,
          "Third Term": 3,
        };

        return order[a.name] - order[b.name];
      });

      const currentIndex = orderedTerms.findIndex((t) => t.id === termId);

      return orderedTerms.slice(0, currentIndex);
    }

    const previousTerms = await getPreviousTerms(termId);

    if (!classId || !termId) {
      return res.status(400).json({
        error: "classId and termId are required",
      });
    }

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
      return res.status(404).json({
        error: "No results found for this student",
      });
    }

    // if (!results.length) {
    //   const results = await prisma.subject.findMany({
    //     where: classId ? { classId } : undefined,
    //     include: { class: true },
    //     orderBy: { name: "asc" },
    //   });
    //   // res.json(subjects);
    // return res.status(404).json({
    //   error: "No results found for student",
    // });

    // 2. Compute subject positions
    const subjectPositions = await computeSubjectPositions({
      classId,
      termId,
    });

    //Attendance Summary
    const attendance = await prisma.attendanceSummary.findUnique({
      where: {
        studentId_termId: {
          studentId,
          termId,
        },
      },
    });

    const attendanceData = attendance
      ? {
          schoolOpened: attendance.schoolOpened,
          present: attendance.present,
          punctual: attendance.punctual,
          absent: attendance.schoolOpened - attendance.present,
        }
      : null;

    const assessments = await prisma.assessment.findMany({
      where: {
        studentId,
        termId,
      },
      include: {
        category: true,
      },
    });

    const behaviour = assessments
      .filter((a) => a.category.type === "Behaviour")
      .map((a) => ({
        name: a.category.name,
        score: a.score,
        remark: a.remark,
      }));

    const psychomotor = assessments
      .filter((a) => a.category.type === "Psychomotor")
      .map((a) => ({
        name: a.category.name,
        score: a.score,
        remark: a.remark,
      }));

    const sports = assessments
      .filter((a) => a.category.type === "Sports")
      .map((a) => ({
        name: a.category.name,
        score: a.score,
        remark: a.remark,
      }));

    const clubs = assessments
      .filter((a) => a.category.type === "Clubs")
      .map((a) => ({
        name: a.category.name,
        score: a.score,
        remark: a.remark,
      }));

    const teacherComment =
      assessments.find(
        (a) =>
          a.category.type === "Comments" &&
          a.category.name === "Teacher Comment",
      )?.score || "";

    const principalComment =
      assessments.find(
        (a) =>
          a.category.type === "Comments" &&
          a.category.name === "Principal Comment",
      )?.score || "";

    // function groupAssessments(records) {
    //   return {
    //     behaviour: records
    //       .filter((x) => x.category.name === "Behaviour")
    //       .map((x) => ({
    //         name: x.name,
    //         score: x.score,
    //       })),

    //     psychomotor: records
    //       .filter((x) => x.category.name === "Psychomotor")
    //       .map((x) => ({
    //         name: x.name,
    //         score: x.score,
    //       })),

    //     sports: records
    //       .filter((x) => x.category.name === "Sports")
    //       .map((x) => ({
    //         name: x.name,
    //         score: x.score,
    //       })),

    //     clubs: records
    //       .filter((x) => x.category.name === "Clubs")
    //       .map((x) => ({
    //         name: x.name,
    //         score: x.score,
    //       })),

    //     teacherComment: records
    //       .filter((x) => x.category.name === "teacherComment")
    //       .map((x) => ({
    //         name: x.name,
    //         score: x.score,
    //       })),
    //     principalComment: records
    //       .filter((x) => x.category.name === "principalComment")
    //       .map((x) => ({
    //         name: x.name,
    //         score: x.score,
    //       })),
    //   };
    // }

    // 3. Enrich subject results
    const enrichedResults = await Promise.all(
      results.map(async (r) => {
        const subjectRankList = subjectPositions[r.subjectId] || [];

        const studentRank = subjectRankList.find(
          (s) => s.studentId === studentId,
        );

        const previousResults = await prisma.result.findMany({
          where: {
            studentId,
            subjectId: r.subjectId,
            termId: {
              in: previousTerms.map((t) => t.id),
            },
          },
          include: {
            term: true,
          },
        });

        const firstTermResult = previousResults.find(
          (x) => x.term.name === "First Term",
        );

        const secondTermResult = previousResults.find(
          (x) => x.term.name === "Second Term",
        );

        return {
          subject: r.subject.name,

          attendanceScore: r.attendanceScore ?? 0,
          assignmentScore: r.assignmentScore ?? 0,
          ca1Score: r.ca1Score ?? 0,
          ca2Score: r.ca2Score ?? 0,

          examScore: r.examScore ?? 0,
          TotalScore: r.TotalScore ?? 0,

          firstTermScore: firstTermResult?.TotalScore ?? null,

          secondTermScore: secondTermResult?.TotalScore ?? null,

          grade: getGrade(r.TotalScore),

          subjectPosition: studentRank?.position ?? null,

          remark: getRemark(r.TotalScore),
        };
      }),
    );

    //  4. Compute TOTAL + AVERAGE
    const totalScore = results.reduce((sum, r) => sum + (r.TotalScore || 0), 0);

    const average = results.length > 0 ? totalScore / results.length : 0;

    //  5. Final Grade
    const finalGrade = getGrade(average);

    //  6. Overall Position (reuse earlier function)
    const ranking = await computeStudentPosition({
      classId,
      termId,
    });

    const studentRank = ranking.find((s) => s.studentId === studentId);

    // Final response
    res.json({
      student: {
        id: student.id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        sportHouse: student.sportHouse,
        passportPhoto: student.passportPhoto,
        class: student.class,
      },

      school,

      term: {
        id: currentTerm.id,
        name: currentTerm.name,
      },

      session: currentTerm.session,

      classSize,

      attendance: attendanceData,

      assessments: {
        behaviour,
        psychomotor,
        sports,
        clubs,
      },

      comments: {
        teacher: teacherComment,
        principal: principalComment,
      },

      summary: {
        totalScore,
        average: Number(average.toFixed(2)),
        finalGrade,
        position: studentRank?.position ?? null,

        subjectsOffered: results.length,

        classSize,
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
//  7. Final Response
//     res.json({
//       studentId,
//       termId,

//       summary: {
//         totalScore,
//         average: Number(average.toFixed(2)),
//         finalGrade,
//         position: studentRank ? studentRank.position : null,
//       },

//       subjects: enrichedResults,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       error: "Failed to fetch student result",
//     });
//   }
// });

//POST upsert report-card

router.post("/report-card", staffOnly, async (req, res) => {
  const {
    studentId,
    termId,
    attendance,
    results = [],
    assessments = [],
  } = req.body;

  if (!studentId || !termId) {
    return res.status(400).json({
      error: "studentId and termId are required",
    });
  }

  try {
    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    // Verify term exists
    const term = await prisma.term.findUnique({
      where: { id: termId },
    });

    if (!term) {
      return res.status(404).json({
        error: "Term not found",
      });
    }

    // ==========================
    // Validate Subject Results
    // ==========================
    for (const item of results) {
      const attendanceScore = Number(item.attendanceScore || 0);
      const assignmentScore = Number(item.assignmentScore || 0);
      const ca1Score = Number(item.ca1Score || 0);
      const ca2Score = Number(item.ca2Score || 0);
      const examScore = Number(item.examScore || 0);

      if (attendanceScore < 0 || attendanceScore > 5) {
        return res.status(400).json({
          error: `Attendance score must be between 0 and 5`,
        });
      }

      if (assignmentScore < 0 || assignmentScore > 5) {
        return res.status(400).json({
          error: `Assignment score must be between 0 and 5`,
        });
      }

      if (ca1Score < 0 || ca1Score > 15) {
        return res.status(400).json({
          error: `CA1 score must be between 0 and 15`,
        });
      }

      if (ca2Score < 0 || ca2Score > 15) {
        return res.status(400).json({
          error: `CA2 score must be between 0 and 15`,
        });
      }

      if (examScore < 0 || examScore > 60) {
        return res.status(400).json({
          error: `Exam score must be between 0 and 60`,
        });
      }
    }

    const transactionQueries = [];

    // ==========================
    // Attendance Summary
    // ==========================
    if (attendance) {
      transactionQueries.push(
        prisma.attendanceSummary.upsert({
          where: {
            studentId_termId: {
              studentId,
              termId,
            },
          },

          update: {
            schoolOpened: Number(attendance.schoolOpened || 0),
            present: Number(attendance.present || 0),
            punctual: Number(attendance.punctual || 0),
          },

          create: {
            studentId,
            termId,
            schoolOpened: Number(attendance.schoolOpened || 0),
            present: Number(attendance.present || 0),
            punctual: Number(attendance.punctual || 0),
          },
        }),
      );
    }

    // ==========================
    // Academic Results
    // ==========================
    for (const item of results) {
      const attendanceScore = Number(item.attendanceScore || 0);
      const assignmentScore = Number(item.assignmentScore || 0);
      const ca1Score = Number(item.ca1Score || 0);
      const ca2Score = Number(item.ca2Score || 0);
      const examScore = Number(item.examScore || 0);

      const TotalScore =
        attendanceScore + assignmentScore + ca1Score + ca2Score + examScore;

      transactionQueries.push(
        prisma.result.upsert({
          where: {
            studentId_subjectId_termId: {
              studentId,
              subjectId: item.subjectId,
              termId,
            },
          },

          update: {
            attendanceScore,
            assignmentScore,
            ca1Score,
            ca2Score,
            examScore,
            TotalScore,
            recordedById: req.user.id,
          },

          create: {
            studentId,
            subjectId: item.subjectId,
            termId,

            attendanceScore,
            assignmentScore,
            ca1Score,
            ca2Score,
            examScore,

            TotalScore,
            recordedById: req.user.id,
          },
        }),
      );
    }

    // ==========================
    // Behaviour / Psychomotor /
    // Sports / Clubs / Comments
    // ==========================
    for (const item of assessments) {
      transactionQueries.push(
        prisma.assessment.upsert({
          where: {
            studentId_termId_categoryId: {
              studentId,
              termId,
              categoryId: item.categoryId,
            },
          },

          update: {
            score: item.score ?? "",
            remark: item.remark ?? "",
          },

          create: {
            studentId,
            termId,
            categoryId: item.categoryId,
            score: item.score ?? "",
            remark: item.remark ?? "",
          },
        }),
      );
    }

    // ==========================
    // Save Everything
    // ==========================
    await prisma.$transaction(transactionQueries);

    await log({
      req,
      action: "CREATE",
      entity: "ReportCard",
      entityId: studentId,
      detail: `Saved report card for ${student.name}`,
      metadata: {
        studentId,
        termId,
        subjects: results.length,
        assessments: assessments.length,
      },
    });

    return res.json({
      success: true,
      message: "Report card saved successfully",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to save report card",
    });
  }
});

//Get report card for a student for a term

router.get("/report-card/:studentId", async (req, res) => {
  const { studentId } = req.params;
  const { termId } = req.query;

  if (!termId) {
    return res.status(400).json({
      error: "termId is required",
    });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: true,
      },
    });

    if (!student) {
      return res.status(404).json({
        error: "Student not found",
      });
    }

    // =========================
    // SUBJECT RESULTS
    // =========================

    const results = await prisma.result.findMany({
      where: {
        studentId,
        termId,
      },
      include: {
        subject: true,
      },
      orderBy: {
        subject: {
          name: "asc",
        },
      },
    });

    // =========================
    // ATTENDANCE
    // =========================

    const attendance = await prisma.attendanceSummary.findUnique({
      where: {
        studentId_termId: {
          studentId,
          termId,
        },
      },
    });

    // =========================
    // ASSESSMENT CATEGORIES
    // =========================

    const categories = await prisma.assessmentCategory.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    // =========================
    // STUDENT ASSESSMENTS
    // =========================

    const assessments = await prisma.assessment.findMany({
      where: {
        studentId,
        termId,
      },
      include: {
        category: true,
      },
    });

    // // =========================
    // // ASSESSMENTS
    // // =========================

    // const assessments = await prisma.assessment.findMany({
    //   where: {
    //     studentId,
    //     termId,
    //   },
    //   include: {
    //     category: true,
    //   },
    // });

    const template = {
      Behaviour: [],
      Psychomotor: [],
      Sport: [],
      Clubs: [],
      Comments: [],
    };

    categories.forEach((category) => {
      const type = category.type;

      if (!template[type]) {
        template[type] = [];
      }

      template[type].push({
        id: category.id,
        name: category.name,
        type: category.type,
        description: category.description,
      });
    });

    const assessmentMap = {};

    assessments.forEach((assessment) => {
      assessmentMap[assessment.categoryId] = {
        id: assessment.id,
        score: assessment.score,
        remark: assessment.remark,
      };
    });

    const mergedTemplate = {};

    Object.keys(template).forEach((type) => {
      mergedTemplate[type] = template[type].map((category) => ({
        categoryId: category.id,
        name: category.name,
        type: category.type,

        score: assessmentMap[category.id]?.score || "",

        remark: assessmentMap[category.id]?.remark || "",
      }));
    });

    const grouped = {
      Behaviour: [],
      Psychomotor: [],
      Sport: [],
      Clubs: [],
      Comments: [],
    };

    assessments.forEach((item) => {
      const type = item.category.type;

      if (!grouped[type]) {
        grouped[type] = [];
      }

      grouped[type].push({
        id: item.id,
        categoryId: item.categoryId,
        name: item.category.name,
        score: item.score,
        remark: item.remark,
      });
    });

    const teacherComment =
      mergedTemplate.Comments?.find((x) => x.name === "Teacher Comment")
        ?.score || "";

    const principalComment =
      mergedTemplate.Comments?.find((x) => x.name === "Principal Comment")
        ?.score || "";

    res.json({
      student,

      academics: results.map((r) => ({
        resultId: r.id,
        subjectId: r.subjectId,
        subject: r.subject.name,

        attendanceScore: r.attendanceScore ?? 0,
        assignmentScore: r.assignmentScore ?? 0,
        ca1Score: r.ca1Score ?? 0,
        ca2Score: r.ca2Score ?? 0,
        examScore: r.examScore ?? 0,

        TotalScore: r.TotalScore ?? 0,
      })),

      attendance: attendance
        ? {
            schoolOpened: attendance.schoolOpened,
            present: attendance.present,
            punctual: attendance.punctual,
          }
        : {
            schoolOpened: "",
            present: "",
            punctual: "",
          },

      template: mergedTemplate,

      behaviour: mergedTemplate.Behaviour,

      psychomotor: mergedTemplate.Psychomotor,

      sports: mergedTemplate.Sport,

      clubs: mergedTemplate.Clubs,

      comments: {
        teacher: teacherComment,
        principal: principalComment,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load report card",
    });
  }
});

// GET report card template categories
router.get("/report-card-template", async (req, res) => {
  try {
    const categories = await prisma.assessmentCategory.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    const grouped = {
      Behaviour: [],
      Psychomotor: [],
      Sport: [],
      Clubs: [],
      Comments: [],
    };

    categories.forEach((category) => {
      const type = category.type;

      if (!grouped[type]) {
        grouped[type] = [];
      }

      grouped[type].push({
        id: category.id,
        name: category.name,
        type: category.type,
        description: category.description,
      });
    });

    res.json(grouped);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load report card template",
    });
  }
});

// POST upsert a score
router.post("/", staffOnly, async (req, res) => {
  const { studentId, termId, results } = req.body;

  if (!studentId || !termId || !Array.isArray(results)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    // Validate first BEFORE touching DB
    for (const item of results) {
      const {
        attendanceScore = 0,
        assignmentScore = 0,
        ca1Score = 0,
        ca2Score = 0,
        examScore = 0,
      } = item;

      if (
        assignmentScore > 5 ||
        attendanceScore > 5 ||
        ca1Score > 15 ||
        ca2Score > 15 ||
        examScore > 60
      ) {
        return res.status(400).json({
          error: `Invalid score range for subjectId: ${item.subjectId}`,
        });
      }
    }

    //  Build queries (NOT promises yet)
    const queries = results.map((item) => {
      const { subjectId, testScore = 0, examScore = 0 } = item;

      const totalScore =
        Number(attendanceScore) +
        Number(assignmentScore) +
        Number(ca1Score) +
        Number(ca2Score) +
        Number(examScore);

      const attendanceQuery = prisma.attendanceSummary.upsert({
        where: {
          studentId_termId: {
            studentId,
            termId,
          },
        },

        update: {
          schoolOpened,
          present,
          punctual,
        },

        create: {
          studentId,
          termId,
          schoolOpened,
          present,
          punctual,
        },
      });

      const assessmentQueries = assessments.map((a) =>
        prisma.assessment.upsert({
          where: {
            studentId_termId_categoryId: {
              studentId,
              termId,
              categoryId: a.categoryId,
            },
          },

          update: {
            score: a.score,
            remark: a.remark,
          },

          create: {
            studentId,
            termId,
            categoryId: a.categoryId,
            score: a.score,
            remark: a.remark,
          },
        }),
      );

      return prisma.result.upsert({
        where: {
          studentId_subjectId_termId: {
            studentId,
            subjectId,
            termId,
          },
        },
        update: {
          ca1Score: parseFloat(ca1Score),
          ca2Score: parseFloat(ca2Score),
          assignmentScore: parseFloat(assignmentScore),
          attendanceScore: parseFloat(attendanceScore),
          examScore: parseFloat(examScore),
          TotalScore: totalScore,
          recordedById: req.user.id,
        },
        create: {
          studentId,
          subjectId,
          termId,
          ca1Score: parseFloat(ca1Score),
          ca2Score: parseFloat(ca2Score),
          assignmentScore: parseFloat(assignmentScore),
          attendanceScore: parseFloat(attendanceScore),
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
