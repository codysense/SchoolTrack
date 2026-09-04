import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, adminOnly, staffOnly } from "../middleware/auth.js";
import { log } from "../services/audit.service.js";
import { uploadStudentPhoto } from "../middleware/uploadStudentPhoto.js";
import { uploadToCloudinary } from "./utils/cloudinary.js";
import { calculateStudentFeeBreakdown } from "../utils/scholarship.js";

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate);

async function generateAdmissionNumber(classId) {
  const PS_CLASSES = [
    "PRESCHOOL",
    "PREPARATORY CLASS 1",
    "PREPARATORY CLASS 2",
    "PREPARATORY CLASS 3",
  ];

  const studentClass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      className: true,
    },
  });

  if (!studentClass) {
    throw new Error("Class not found");
  }

  const section = PS_CLASSES.includes(
    studentClass.className.trim().toUpperCase(),
  )
    ? "PS"
    : "PR";

  const lastStudent = await prisma.student.findFirst({
    where: {
      admissionNumber: {
        startsWith: `TLH/${section}/`,
      },
    },
    orderBy: {
      admissionNumber: "desc",
    },
    select: {
      admissionNumber: true,
    },
  });

  let nextNumber = 1;

  if (lastStudent) {
    const parts = lastStudent.admissionNumber.split("/");
    nextNumber = parseInt(parts[2], 10) + 1;
  }

  return `TLH/${section}/${String(nextNumber).padStart(6, "0")}`;
}
// GET all students

// async function generateAdmissionNumber(classId) {
//   const PS_NAMES = [
//     "Preschool",
//     "Preparatory Class 1",
//     "Preparatory Class 2",
//     "Preparatory Class 3",
//   ];

//   const studentClass = await prisma.class.findUnique({
//     where: { id: classId },
//     select: { className: true },
//   });

//   if (!studentClass) throw new Error("Class not found");

//   // console.log(studentClass.className);

//   const isPSClass = PS_NAMES.map((n) => n.toLowerCase()).includes(
//     studentClass.className.toLowerCase(),
//   );

//   // const countWhere = isPSClass
//   //   ? { class: { className: { in: PS_NAMES } } }
//   //   : { NOT: { class: { className: { in: PS_NAMES } } } };

//   const countWhere = isPSClass
//     ? { class: { is: { className: { in: PS_NAMES } } } }
//     : { class: { is: { className: { notIn: PS_NAMES } } } };

//   const sectionCount = await prisma.student.count({ where: countWhere });

//   const section = isPSClass ? "PS" : "PR";

//   // console.log("Section Count", sectionCount, "Section", section);
//   return `TLH/${section}/${String(sectionCount + 1).padStart(6, "0")}`;
// }

router.get("/", staffOnly, async (req, res) => {
  const { classId, termId, includeInactive, status } = req.query;

  // Teachers only see their assigned class
  let filterClassId = classId;
  if (req.user.role === "TEACHER" && req.user.teacher?.classId) {
    filterClassId = req.user.teacher.classId;
  }

  let statusWhere = {};
  if (status && status.toUpperCase() !== "ALL") {
    statusWhere = { status: status.toUpperCase() };
  } else if (!status && !includeInactive) {
    statusWhere = { status: "ACTIVE" };
  }

  const students = await prisma.student.findMany({
    where: {
      ...(filterClassId && { classId: filterClassId }),
      ...statusWhere,
    },
    include: {
      class: true,
      payments: termId ? { where: { termId } } : true,
      optionalFeeAssigns: termId
        ? { where: { termId }, include: { optionalFee: true, payments: true } }
        : { include: { optionalFee: true, payments: true } },
      studentTermFees: termId ? { where: { termId } } : true,
    },
    orderBy: { name: "asc" },
  });
  // console.log("Fetched students:", students);
  const data = students.map((s) => {
    const schoolPaid = s.payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const optExpectedBase = s.optionalFeeAssigns.reduce(
      (sum, a) => sum + a.optionalFee.amount,
      0,
    );
    const optPaid = s.optionalFeeAssigns.reduce(
      (sum, a) => sum + a.payments.reduce((sp, p) => sp + p.amountPaid, 0),
      0,
    );

    const termSnapshot = termId
      ? s.studentTermFees?.find((tf) => tf.termId === termId) || s.studentTermFees?.[0] || null
      : null;

    const breakdown = calculateStudentFeeBreakdown(s, optExpectedBase, termSnapshot);
    const totalPaid = schoolPaid + optPaid;

    return {
      ...s,
      schoolPaid,
      optPaid,
      totalPaid,
      schoolFee: breakdown.expectedSchoolFee,
      baseSchoolFee: breakdown.baseSchoolFee,
      schoolFeeDiscount: breakdown.schoolFeeDiscount,
      optFeeDiscount: breakdown.optFeeDiscount,
      totalDiscount: breakdown.totalDiscount,
      optExpected: breakdown.expectedOptFee,
      baseOptExpected: breakdown.baseOptFee,
      totalFee: breakdown.totalExpectedFee,
      baseTotalFee: breakdown.baseTotalFee,
      balance: breakdown.totalExpectedFee - totalPaid,
      schoolFeeBalance: breakdown.expectedSchoolFee - schoolPaid,
      optFeeBalance: breakdown.expectedOptFee - optPaid,
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
      studentTermFees: true,
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

  const schoolPaid = student.payments.reduce((s, p) => s + p.amountPaid, 0);
  const optExpectedBase = student.optionalFeeAssigns.reduce(
    (s, a) => s + a.optionalFee.amount,
    0,
  );
  const optPaid = student.optionalFeeAssigns.reduce(
    (s, a) => s + a.payments.reduce((sp, p) => sp + p.amountPaid, 0),
    0,
  );

  const breakdown = calculateStudentFeeBreakdown(student, optExpectedBase);
  const totalPaid = schoolPaid + optPaid;

  res.json({
    ...student,
    schoolPaid,
    optPaid,
    totalPaid,
    schoolFee: breakdown.expectedSchoolFee,
    baseSchoolFee: breakdown.baseSchoolFee,
    schoolFeeDiscount: breakdown.schoolFeeDiscount,
    optFeeDiscount: breakdown.optFeeDiscount,
    totalDiscount: breakdown.totalDiscount,
    optExpected: breakdown.expectedOptFee,
    baseOptExpected: breakdown.baseOptFee,
    totalFee: breakdown.totalExpectedFee,
    baseTotalFee: breakdown.baseTotalFee,
    balance: breakdown.totalExpectedFee - totalPaid,
    schoolFeeBalance: breakdown.expectedSchoolFee - schoolPaid,
    optFeeBalance: breakdown.expectedOptFee - optPaid,
  });
});
//Get Student payment (including optional fees) history for a term
router.get("/:id/payments", staffOnly, async (req, res) => {
  const { termId } = req.query;

  const student = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { class: true },
  });

  if (!student) return res.status(404).json({ error: "Student not found" });

  // 1. Fetch term snapshot if termId provided
  let termSnapshot = null;
  if (termId) {
    termSnapshot = await prisma.studentTermFee.findUnique({
      where: { studentId_termId: { studentId: req.params.id, termId } },
    });
  }

  //Get payments for the student (all or by term)
  const payments = await prisma.payment.findMany({
    where: {
      studentId: req.params.id,
      ...(termId && { termId }),
    },
    include: {
      term: {
        include: { session: true },
      },
    },
    orderBy: { date: "desc" },
  });

  //Get optional fee payments for the student
  const optPayments = await prisma.optionalFeePayment.findMany({
    where: {
      studentId: req.params.id,
      ...(termId && { optionalFeeAssign: { termId } }),
    },
    include: {
      optionalFeeAssign: {
        include: {
          optionalFee: true,
          term: { include: { session: true } },
        },
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
  const optFeeExpectedBase = optFees.reduce((s, a) => s + a.optionalFee.amount, 0);
  const breakdown = calculateStudentFeeBreakdown(student, optFeeExpectedBase, termSnapshot);

  //Get optional fees paid for the student for the term
  const optFeeExpected = breakdown.expectedOptFee;
  const optFeePaid = optPayments.reduce((s, p) => s + p.amountPaid, 0);
  const optFeeBalance = optFeeExpected - optFeePaid;

  res.json({
    payments,
    optPayments,
    optFeeExpected,
    optFeePaid,
    optFeeBalance,
    breakdown,
  });
});

// POST create student
router.post(
  "/",
  adminOnly,
  uploadStudentPhoto.single("passportPhoto"),
  async (req, res) => {
    try {
      // 1. If a passport photo was uploaded, upload it to Cloudinary
      let passportPhotoUrl = null;
      if (req.file) {
        passportPhotoUrl = await uploadToCloudinary(
          req.file.buffer,
          "students",
        );
      }

      let {
        admissionNumber,
        name,

        // Parent Information
        parentName,
        parentPhone,
        parentEmail,
        parentAddress,

        // Academic Information
        classId,
        entryClass,
        admissionDate,

        // Student Information
        gender,
        dateOfBirth,
        sportHouse,

        // Health Information
        bloodGroup,
        genotype,

        // Physical Information
        height,
        weight,

        // Scholarship Information
        hasScholarship,
        scholarshipType,
        scholarshipValue,
        scholarshipTarget,
        scholarshipReason,

        status,
        isActive,
      } = req.body;

      if (!admissionNumber?.trim()) {
        admissionNumber = await generateAdmissionNumber(classId);
      }

      const isScholarshipActive = hasScholarship === true || hasScholarship === "true";

      let studentStatus = status ? status.trim().toUpperCase() : "ACTIVE";
      if (isActive !== undefined && (isActive === false || isActive === "false") && studentStatus === "ACTIVE") {
        studentStatus = "LEFT";
      }
      const isStudentActive = studentStatus === "ACTIVE";

      const student = await prisma.student.create({
        data: {
          admissionNumber: admissionNumber.trim(),
          name: name?.trim(),

          // Parent Information
          parentName: parentName?.trim() || null,
          parentPhone: parentPhone?.trim(),
          parentEmail: parentEmail?.trim() || null,
          parentAddress: parentAddress?.trim() || null,

          // Academic Information
          class: { connect: { id: classId } },
          entryClass: entryClass?.trim() || null,
          admissionDate: admissionDate ? new Date(admissionDate) : null,

          // Student Information
          gender: gender || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          sportHouse: sportHouse?.trim() || null,

          // Health Information
          bloodGroup: bloodGroup?.trim() || null,
          genotype: genotype?.trim() || null,

          // Physical Information
          height:
            height !== undefined && height !== null && height !== ""
              ? parseFloat(height)
              : null,

          weight:
            weight !== undefined && weight !== null && weight !== ""
              ? parseFloat(weight)
              : null,

          // Scholarship Information
          hasScholarship: isScholarshipActive,
          scholarshipType: isScholarshipActive ? (scholarshipType?.trim() || "PERCENTAGE") : null,
          scholarshipValue:
            isScholarshipActive && scholarshipValue !== undefined && scholarshipValue !== null && scholarshipValue !== ""
              ? parseFloat(scholarshipValue)
              : null,
          scholarshipTarget: isScholarshipActive ? (scholarshipTarget?.trim() || "TUITION") : "TUITION",
          scholarshipReason: isScholarshipActive ? (scholarshipReason?.trim() || null) : null,

          // Status & Activity
          status: studentStatus,
          isActive: isStudentActive,

          // Media (Saves Cloudinary HTTPS URL)
          passportPhoto: passportPhotoUrl,
        },
        include: {
          class: true,
        },
      });

      // Upsert snapshot for current term
      const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
      if (currentTerm) {
        const baseSchoolFee = student.class?.feeAmount || 0;
        const breakdown = calculateStudentFeeBreakdown(student, 0);

        await prisma.studentTermFee.upsert({
          where: { studentId_termId: { studentId: student.id, termId: currentTerm.id } },
          create: {
            studentId: student.id,
            termId: currentTerm.id,
            baseSchoolFee,
            hasScholarship: breakdown.hasScholarship,
            scholarshipType: breakdown.hasScholarship ? breakdown.scholarshipType : null,
            scholarshipValue: breakdown.hasScholarship ? breakdown.scholarshipValue : null,
            scholarshipTarget: breakdown.hasScholarship ? breakdown.scholarshipTarget : "TUITION",
            scholarshipReason: breakdown.hasScholarship ? breakdown.scholarshipReason : null,
            discountAmount: breakdown.schoolFeeDiscount,
            expectedSchoolFee: breakdown.expectedSchoolFee,
          },
          update: {
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
      }

      await log({
        req,
        action: "CREATE",
        entity: "Student",
        entityId: student.id,
        detail: `Registered student "${student.name}" (${student.admissionNumber}) in ${student.class.className}`,
      });

      res.status(201).json(student);
    } catch (e) {
      if (e.code === "P2002") {
        return res.status(409).json({
          error: "Admission number already exists",
        });
      }

      console.error(e);

      return res.status(500).json({
        error: "Failed to create student",
      });
    }
  },
);

// PUT update student
router.put(
  "/:id",
  adminOnly,
  uploadStudentPhoto.single("passportPhoto"),
  async (req, res) => {
    try {
      const existingStudent = await prisma.student.findUnique({
        where: { id: req.params.id },
      });

      if (!existingStudent) {
        return res.status(404).json({
          error: "Student not found",
        });
      }

      // 1. If a new photo is uploaded, send it to Cloudinary; otherwise keep existing image URL
      let passportPhotoUrl = existingStudent.passportPhoto;
      if (req.file) {
        passportPhotoUrl = await uploadToCloudinary(
          req.file.buffer,
          "students",
        );
      }

      let {
        name,
        parentPhone,
        classId,
        admissionNumber,
        isActive,
        parentName,
        parentEmail,
        parentAddress,
        entryClass,
        admissionDate,
        gender,
        dateOfBirth,
        sportHouse,
        bloodGroup,
        genotype,
        height,
        weight,
        hasScholarship,
        scholarshipType,
        scholarshipValue,
        scholarshipTarget,
        scholarshipReason,

        status,
      } = req.body;

      if (!admissionNumber?.trim()) {
        admissionNumber = await generateAdmissionNumber(classId);
      }

      const isScholarshipActive = hasScholarship === true || hasScholarship === "true";

      let studentStatus = status ? status.trim().toUpperCase() : (existingStudent?.status || "ACTIVE");
      if (isActive !== undefined) {
        if ((isActive === false || isActive === "false") && studentStatus === "ACTIVE") {
          studentStatus = "LEFT";
        } else if (isActive === true || isActive === "true") {
          studentStatus = "ACTIVE";
        }
      }
      const isStudentActive = studentStatus === "ACTIVE";

      const student = await prisma.student.update({
        where: { id: req.params.id },
        data: {
          admissionNumber: admissionNumber.trim(),
          name: name?.trim(),

          // Parent Information
          parentName: parentName?.trim() || null,
          parentPhone: parentPhone?.trim(),
          parentEmail: parentEmail?.trim() || null,
          parentAddress: parentAddress?.trim() || null,

          // Academic Information
          ...(classId && { class: { connect: { id: classId } } }),
          entryClass: entryClass?.trim() || null,
          admissionDate: admissionDate ? new Date(admissionDate) : null,

          // Student Information
          gender: gender || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          sportHouse: sportHouse?.trim() || null,

          // Health Information
          bloodGroup: bloodGroup?.trim() || null,
          genotype: genotype?.trim() || null,

          // Physical Information
          height:
            height !== undefined && height !== null && height !== ""
              ? parseFloat(height)
              : null,

          weight:
            weight !== undefined && weight !== null && weight !== ""
              ? parseFloat(weight)
              : null,

          // Scholarship Information
          hasScholarship: isScholarshipActive,
          scholarshipType: isScholarshipActive ? (scholarshipType?.trim() || "PERCENTAGE") : null,
          scholarshipValue:
            isScholarshipActive && scholarshipValue !== undefined && scholarshipValue !== null && scholarshipValue !== ""
              ? parseFloat(scholarshipValue)
              : null,
          scholarshipTarget: isScholarshipActive ? (scholarshipTarget?.trim() || "TUITION") : "TUITION",
          scholarshipReason: isScholarshipActive ? (scholarshipReason?.trim() || null) : null,

          // Status & Activity
          status: studentStatus,
          isActive: isStudentActive,

          // Media (Saves Cloudinary HTTPS URL)
          passportPhoto: passportPhotoUrl,
        },
        include: { class: true },
      });

      // Upsert snapshot for current term without modifying past terms
      const currentTerm = await prisma.term.findFirst({ where: { isCurrent: true } });
      if (currentTerm) {
        const baseSchoolFee = student.class?.feeAmount || 0;
        const breakdown = calculateStudentFeeBreakdown(student, 0);

        await prisma.studentTermFee.upsert({
          where: { studentId_termId: { studentId: student.id, termId: currentTerm.id } },
          create: {
            studentId: student.id,
            termId: currentTerm.id,
            baseSchoolFee,
            hasScholarship: breakdown.hasScholarship,
            scholarshipType: breakdown.hasScholarship ? breakdown.scholarshipType : null,
            scholarshipValue: breakdown.hasScholarship ? breakdown.scholarshipValue : null,
            scholarshipTarget: breakdown.hasScholarship ? breakdown.scholarshipTarget : "TUITION",
            scholarshipReason: breakdown.hasScholarship ? breakdown.scholarshipReason : null,
            discountAmount: breakdown.schoolFeeDiscount,
            expectedSchoolFee: breakdown.expectedSchoolFee,
          },
          update: {
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
      }

      await log({
        req,
        action: "UPDATE",
        entity: "Student",
        entityId: student.id,
        detail: `Updated student "${student.name}"`,
      });

      res.json(student);
    } catch (e) {
      console.error(e);
      return res.status(500).json({
        error: "Failed to update student",
      });
    }
  },
);

// // POST create student
// router.post(
//   "/",
//   adminOnly,
//   uploadStudentPhoto.single("passportPhoto"),
//   async (req, res) => {
//     const passportPhoto = req.file
//       ? `/uploads/students/${req.file.filename}`
//       : null;
//     let {
//       admissionNumber,
//       name,

//       // Parent Information
//       parentName,
//       parentPhone,
//       parentEmail,
//       parentAddress,

//       // Academic Information
//       classId,
//       entryClass,
//       admissionDate,

//       // Student Information
//       gender,
//       dateOfBirth,
//       sportHouse,

//       // Health Information
//       bloodGroup,
//       genotype,

//       // Physical Information
//       height,
//       weight,

//       // Media
//       // passportPhoto,
//     } = req.body;

//     if (!admissionNumber?.trim()) {
//       admissionNumber = await generateAdmissionNumber(classId);
//     }

//     try {
//       const student = await prisma.student.create({
//         data: {
//           admissionNumber: admissionNumber.trim(),
//           name: name?.trim(),

//           // Parent Information
//           parentName: parentName?.trim() || null,
//           parentPhone: parentPhone?.trim(),
//           parentEmail: parentEmail?.trim() || null,
//           parentAddress: parentAddress?.trim() || null,

//           // Academic Information
//           classId,
//           entryClass: entryClass?.trim() || null,
//           admissionDate: admissionDate ? new Date(admissionDate) : null,

//           // Student Information
//           gender: gender || null,
//           dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
//           sportHouse: sportHouse?.trim() || null,

//           // Health Information
//           bloodGroup: bloodGroup?.trim() || null,
//           genotype: genotype?.trim() || null,

//           // Physical Information
//           height:
//             height !== undefined && height !== null && height !== ""
//               ? parseFloat(height)
//               : null,

//           weight:
//             weight !== undefined && weight !== null && weight !== ""
//               ? parseFloat(weight)
//               : null,

//           // Media
//           passportPhoto: passportPhoto,
//         },
//         include: {
//           class: true,
//         },
//       });

//       await log({
//         req,
//         action: "CREATE",
//         entity: "Student",
//         entityId: student.id,
//         detail: `Registered student "${student.name}" (${student.admissionNumber}) in ${student.class.className}`,
//       });

//       res.status(201).json(student);
//     } catch (e) {
//       if (e.code === "P2002") {
//         return res.status(409).json({
//           error: "Admission number already exists",
//         });
//       }

//       console.error(e);

//       return res.status(500).json({
//         error: "Failed to create student",
//       });
//     }
//   },
// );

// // PUT update student

// router.put(
//   "/:id",
//   adminOnly,
//   uploadStudentPhoto.single("passportPhoto"),
//   async (req, res) => {
//     const existingStudent = await prisma.student.findUnique({
//       where: { id: req.params.id },
//     });

//     if (!existingStudent) {
//       return res.status(404).json({
//         error: "Student not found",
//       });
//     }

//     const passportPhoto = req.file
//       ? `/uploads/students/${req.file.filename}`
//       : existingStudent.passportPhoto;
//     let {
//       name,
//       parentPhone,
//       classId,
//       admissionNumber,
//       isActive,
//       parentName,
//       parentEmail,
//       parentAddress,
//       entryClass,
//       admissionDate,
//       gender,
//       dateOfBirth,
//       sportHouse,
//       bloodGroup,
//       genotype,
//       height,
//       weight,
//     } = req.body;
//     // console.log("Updating student with data:", req.file);

//     if (!admissionNumber?.trim()) {
//       admissionNumber = await generateAdmissionNumber(classId);
//     }

//     const student = await prisma.student.update({
//       where: { id: req.params.id },
//       data: {
//         admissionNumber: admissionNumber.trim(),
//         name: name?.trim(),

//         // Parent Information
//         parentName: parentName?.trim() || null,
//         parentPhone: parentPhone?.trim(),
//         parentEmail: parentEmail?.trim() || null,
//         parentAddress: parentAddress?.trim() || null,

//         // Academic Information
//         classId,
//         entryClass: entryClass?.trim() || null,
//         admissionDate: admissionDate ? new Date(admissionDate) : null,

//         // Student Information
//         gender: gender || null,
//         dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
//         sportHouse: sportHouse?.trim() || null,

//         // Health Information
//         bloodGroup: bloodGroup?.trim() || null,
//         genotype: genotype?.trim() || null,

//         // Physical Information
//         height:
//           height !== undefined && height !== null && height !== ""
//             ? parseFloat(height)
//             : null,

//         weight:
//           weight !== undefined && weight !== null && weight !== ""
//             ? parseFloat(weight)
//             : null,

//         // Media
//         passportPhoto: passportPhoto,

//         ...(isActive !== undefined && { isActive }),
//       },
//       include: { class: true },
//     });
//     await log({
//       req,
//       action: "UPDATE",
//       entity: "Student",
//       entityId: student.id,
//       detail: `Updated student "${student.name}"`,
//     });
//     res.json(student);
//   },
// );

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
