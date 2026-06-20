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

      website: true,
    },
  });
  res.json(school || {});
});

router.use(authenticate, studentOnly);

function getGrade(score) {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  if (score >= 0) return "P";
}

function getRemark(score) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Very Good";
  if (score >= 40) return "Good";
  if (score >= 0) return "Poor";
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

// GET /api/portal/results/:studentId?termId=…
router.get("/results/:studentId", async (req, res) => {
  const { studentId } = req.params;
  const { classId, termId } = req.query;

  if (!termId) return res.status(400).json({ error: "termId is required" });

  const student = await prisma.student.findUnique({
    where: { id: studentId },
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

    // if (!results.length) {
    //   return res.status(404).json({
    //     error: "No results found for this student",
    //   });
    // }

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
      .filter((a) => a.category.type === "Sport")
      .map((a) => ({
        name: a.category.name,
        score: a.score,
        remark: a.remark,
      }));

    const clubs = assessments
      .filter((a) => a.category.type === "Club")
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

        const student = await prisma.student.findUnique({
          where: { id: studentId },
        });

        return {
          student: {
            name: student.name,
            admissionNumber: student.admissionNumber,
            gender: student.gender,
            sportHouse: student.sportHouse,
            passportPhoto: student.passportPhoto,
            dateOfBirth: student.dateOfBirth,
          },

          attendance: {
            schoolOpened: attendanceData?.schoolOpened ?? 0,
            present: attendanceData?.present ?? 0,
            punctual: attendanceData?.punctual ?? 0,
            absent: attendanceData?.absent ?? 0,
          },
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

    // // 1. Fetch student subject results
    // const results = await prisma.result.findMany({
    //   where: {
    //     studentId: studentId,
    //     termId,
    //   },
    //   include: {
    //     subject: true,
    //   },
    // });

    // // 2. Compute subject positions
    // const subjectPositions = await computeSubjectPositions({
    //   classId: student.classId,
    //   termId,
    // });

    // // 3. Enrich subject results
    // const enrichedResults = results.map((r) => {
    //   const subjectRankList = subjectPositions[r.subjectId] || [];

    //   const studentRank = subjectRankList.find(
    //     (s) => s.studentId === studentId,
    //   );

    //   return {
    //     subject: r.subject.name,
    //     assignmentScore: r.assignmentScore,

    //     testScore: r.testScore,
    //     examScore: r.examScore,
    //     TotalScore: r.TotalScore,
    //     grade: getGrade(r.TotalScore),
    //     subjectPosition: studentRank ? studentRank.position : null,
    //     remark: getRemark(r.TotalScore),
    //   };
    // });

    // //  4. Compute TOTAL + AVERAGE
    // const totalScore = results.reduce((sum, r) => sum + r.TotalScore, 0);

    // const average = results.length > 0 ? totalScore / results.length : 0;

    // //  5. Final Grade
    // const finalGrade = getGrade(average);

    // //  6. Overall Position (reuse earlier function)
    // const ranking = await computeStudentPosition({
    //   classId: student.classId,
    //   termId,
    // });

    // const studentRank = ranking.find((s) => s.studentId === studentId);

    //  7. Final Response
    res.json({
      studentId: studentId,
      termId,
      fullyPaid,
      totalBalance,
      canPrint: fullyPaid,

      student: {
        id: student.id,
        name: student.name,
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        sportHouse: student.sportHouse,
        passportPhoto: student.passportPhoto,
        class: student.class,
        dateOfBirth: student.dateOfBirth,
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
      // summary: {
      //   totalScore,
      //   average: Number(average.toFixed(2)),
      //   finalGrade,
      //   position: studentRank ? studentRank.position : null,
      // },

      // subjects: enrichedResults,
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
