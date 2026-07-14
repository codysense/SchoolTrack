import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// const categories = [
//   // Behaviour
//   { name: "Punctuality", type: "Behaviour" },
//   { name: "Neatness", type: "Behaviour" },
//   { name: "Honesty", type: "Behaviour" },
//   { name: "Obedience", type: "Behaviour" },
//   { name: "Leadership", type: "Behaviour" },

//   //Sport
//   { name: "Ball Games", type: "Sport" },
//   { name: "Swimming", type: "Sport" },
//   { name: "Indoor Games", type: "Sport" },
//   { name: "Weight Lifting", type: "Sport" },
//   { name: "Throwing", type: "Sport" },
//   { name: "Jumping", type: "Sport" },
//   { name: "Combative Games", type: "Sport" },
//   { name: "Track and Field", type: "Sport" },

//   { name: "Debate Club", type: "Club" },
//   { name: "Press Club", type: "Club" },
//   { name: "Drama Club", type: "Club" },
//   { name: "Jet Club", type: "Club" },

//   // Psychomotor
//   { name: "Handwriting", type: "Psychomotor" },
//   { name: "Creativity", type: "Psychomotor" },
//   { name: "Sportsmanship", type: "Psychomotor" },
//   { name: "Communication", type: "Psychomotor" },

//   // Comments
//   { name: "Teacher Comment", type: "Comments" },
//   { name: "Principal Comment", type: "Comments" },
// ];

async function main() {
  console.log("🌱 Seeding…");

  // //assessment categories
  // for (const category of categories) {
  //   await prisma.assessmentCategory.upsert({
  //     where: {
  //       name_type: {
  //         name: category.name,
  //         type: category.type,
  //       },
  //     },
  //     update: {},
  //     create: category,
  //   });
  // }

  //School;
  // await prisma.school.upsert({
  //   where: { id: "markaz-taaliim" },
  //   update: {},
  //   create: {
  //     id: "markaz-taaliim",
  //     name: "The Learning Hub",
  //     address:
  //       "ADEKUNLE LAWAL STR, ILUPEJU 2, ZONE 2, ONWARD AREA, OSOGBO OSUN STATE",
  //     phone: "+234 703 891 4429",
  //     email: "markaztaaliim@gmail.com",
  //     motto: "Learning for practice",
  //   },
  // });

  // Admin
  await prisma.user.upsert({
    where: { email: "admin@markaztaaliim.com" },
    update: {},
    create: {
      email: "admin@markaztaaliim.com",
      password: await bcrypt.hash("oedemaje22", 10),
      name: "School Admin",
      role: "ADMIN",
    },
  });

  // Classes;
  // const [PreSchool, PreparatoryClass1, PreparatoryClass2, PreparatoryClass3] =
  //   await Promise.all([
  //     prisma.class.upsert({
  //       where: { className: "PreSchool" },
  //       update: {},
  //       create: { className: "PreSchool", feeAmount: 45000 },
  //     }),
  //     prisma.class.upsert({
  //       where: { className: "Preparatory Class 1" },
  //       update: {},
  //       create: { className: "Preparatory Class 1", feeAmount: 45000 },
  //     }),
  //     prisma.class.upsert({
  //       where: { className: "Preparatory Class 2" },
  //       update: {},
  //       create: { className: "Preparatory Class 2", feeAmount: 55000 },
  //     }),
  //     prisma.class.upsert({
  //       where: { className: "Preparatory Class 3" },
  //       update: {},
  //       create: { className: "Preparatory Class 3", feeAmount: 55000 },
  //     }),
  //   ]);

  // Teacher
  // const teacherUser = await prisma.user.upsert({
  //   where: { email: "teacher@markaztaaliim.com" },
  //   update: {},
  //   create: {
  //     email: "teacher@markaztaaliim.com",
  //     password: await bcrypt.hash("teacher123", 10),
  //     name: "Mrs Adunola Bello",
  //     role: "TEACHER",
  //     teacher: {
  //       create: { classId: PreSchool.id, subjectName: "Mathematics" },
  //     },
  //   },
  // });

  // Subjects
  // for (const [cls, names] of [
  //   [
  //     jss1,
  //     [
  //       "Mathematics",
  //       "English Language",
  //       "Basic Science",
  //       "Social Studies",
  //       "Civic Education",
  //     ],
  //   ],
  //   [
  //     jss2,
  //     [
  //       "Mathematics",
  //       "English Language",
  //       "Basic Science",
  //       "Social Studies",
  //       "Agricultural Science",
  //     ],
  //   ],
  //   [
  //     ss1,
  //     [
  //       "Mathematics",
  //       "English Language",
  //       "Physics",
  //       "Chemistry",
  //       "Biology",
  //       "Economics",
  //     ],
  //   ],
  // ]) {
  //   for (const name of names) {
  //     await prisma.subject.upsert({
  //       where: { name_classId: { name, classId: cls.id } },
  //       update: {},
  //       create: { name, classId: cls.id },
  //     });
  //   }
  // }

  // // Session + Terms
  // let session = await prisma.session.findUnique({
  //   where: { name: "2024/2025" },
  // });
  // if (!session) {
  //   session = await prisma.session.create({
  //     data: {
  //       name: "2024/2025",
  //       isCurrent: true,
  //       terms: {
  //         create: [
  //           { name: "First Term", isCurrent: true },
  //           { name: "Second Term", isCurrent: false },
  //           { name: "Third Term", isCurrent: false },
  //         ],
  //       },
  //     },
  //     include: { terms: true },
  //   });
  // }
  // const firstTerm =
  //   session.terms?.find((t) => t.name === "First Term") ||
  //   (await prisma.term.findFirst({
  //     where: { sessionId: session.id, name: "First Term" },
  //   }));

  // console.log(`✅  Session: ${session.name}, Active term: ${firstTerm.name}`);

  // // Optional fees
  // const [ptaFee, examFee] = await Promise.all([
  //   prisma.optionalFee.upsert({
  //     where: { name: "PTA Levy" },
  //     update: {},
  //     create: {
  //       name: "PTA Levy",
  //       amount: 2000,
  //       description: "Parent-Teacher Association levy",
  //     },
  //   }),
  //   prisma.optionalFee.upsert({
  //     where: { name: "Exam Fee" },
  //     update: {},
  //     create: {
  //       name: "Exam Fee",
  //       amount: 3500,
  //       description: "End-of-term examination fee",
  //     },
  //   }),
  // ]);

  // Students;
  // const studentData = [
  //   {
  //     admissionNumber: "SCH/2024/0001",
  //     name: "Amaka Obi",
  //     parentPhone: "+2348012345678",
  //     classId: jss1.id,
  //   },
  //   {
  //     admissionNumber: "SCH/2024/0002",
  //     name: "Emeka Nwosu",
  //     parentPhone: "+2348023456789",
  //     classId: jss1.id,
  //   },
  //   {
  //     admissionNumber: "SCH/2024/0003",
  //     name: "Fatima Bello",
  //     parentPhone: "+2348034567890",
  //     classId: jss2.id,
  //   },
  //   {
  //     admissionNumber: "SCH/2024/0004",
  //     name: "Tunde Adeyemi",
  //     parentPhone: "+2348045678901",
  //     classId: ss1.id,
  //   },
  // ];
  // const students = [];
  // for (const d of studentData) {
  //   const s = await prisma.student.upsert({
  //     where: { admissionNumber: d.admissionNumber },
  //     update: {},
  //     create: d,
  //   });
  //   students.push(s);
  // }

  // // School fee payments (termId-based)
  // const payAmounts = [45000, 25000, 45000, 30000];
  // for (let i = 0; i < students.length; i++) {
  //   const existing = await prisma.payment.findFirst({
  //     where: { studentId: students[i].id, termId: firstTerm.id },
  //   });
  //   if (!existing) {
  //     await prisma.payment.create({
  //       data: {
  //         studentId: students[i].id,
  //         termId: firstTerm.id,
  //         amountPaid: payAmounts[i],
  //         paymentMethod: i % 2 === 0 ? "transfer" : "cash",
  //         recordedById: null,
  //       },
  //     });
  //   }
  // }

  // // Optional fee assignments (termId-based)
  // for (const student of students) {
  //   for (const fee of [ptaFee, examFee]) {
  //     await prisma.optionalFeeAssign.upsert({
  //       where: {
  //         studentId_optionalFeeId_termId: {
  //           studentId: student.id,
  //           optionalFeeId: fee.id,
  //           termId: firstTerm.id,
  //         },
  //       },
  //       update: {},
  //       create: {
  //         studentId: student.id,
  //         optionalFeeId: fee.id,
  //         termId: firstTerm.id,
  //       },
  //     });
  //   }
  // }

  // Sample results
  // const jss1Subjects = await prisma.subject.findMany({
  //   where: { classId: jss1.id },
  // });
  // const scores = [78, 65, 82, 55, 90];
  // for (const student of [students[0], students[1]]) {
  //   for (let i = 0; i < jss1Subjects.length; i++) {
  //     const total = scores[i % scores.length];
  //     await prisma.result.upsert({
  //       where: {
  //         studentId_subjectId_termId: {
  //           studentId: student.id,
  //           subjectId: jss1Subjects[i].id,
  //           termId: firstTerm.id,
  //         },
  //       },
  //       update: {},

  //       create: {
  //         studentId: student.id,
  //         subjectId,
  //         termId,

  //         attendanceScore: 5,
  //         assignmentScore: 5,
  //         ca1Score: 10,
  //         ca2Score: 10,
  //         examScore: total - 30,

  //         TotalScore: total,
  //       },
  //     });
  //   }
  // }

  console.log("\n🎉 Done!");
  console.log("   Admin:   admin@school.g / admin123");
  // console.log("   Teacher: teacher@school.ng / teacher123");
  // console.log("   Student: SCH/2024/0001 + Abdullah");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
