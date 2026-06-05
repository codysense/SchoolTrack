import { PrismaClient } from '@prisma/client'
import bcrypt           from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding…')

  // School
  await prisma.school.upsert({
    where: { id: 'school-singleton' },
    update: {},
    create: { id: 'school-singleton', name: 'Sunrise Academy', address: '12 School Lane, Ibadan, Oyo State', phone: '+234 800 000 0001', email: 'info@sunriseacademy.ng', motto: 'Knowledge, Character, Excellence' }
  })

  // Admin
  await prisma.user.upsert({
    where: { email: 'admin@school.ng' },
    update: {},
    create: { email: 'admin@school.ng', password: await bcrypt.hash('admin123', 10), name: 'School Admin', role: 'ADMIN' }
  })

  // Classes
  const [jss1, jss2, ss1] = await Promise.all([
    prisma.class.upsert({ where: { className: 'JSS 1' }, update: {}, create: { className: 'JSS 1', feeAmount: 45000 } }),
    prisma.class.upsert({ where: { className: 'JSS 2' }, update: {}, create: { className: 'JSS 2', feeAmount: 45000 } }),
    prisma.class.upsert({ where: { className: 'SS 1'  }, update: {}, create: { className: 'SS 1',  feeAmount: 55000 } }),
  ])

  // Teacher
  const teacherUser = await prisma.user.upsert({
    where: { email: 'teacher@school.ng' },
    update: {},
    create: {
      email: 'teacher@school.ng', password: await bcrypt.hash('teacher123', 10),
      name: 'Mrs Adunola Bello', role: 'TEACHER',
      teacher: { create: { classId: jss1.id, subjectName: 'Mathematics' } }
    }
  })

  // Subjects
  for (const [cls, names] of [
    [jss1, ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Civic Education']],
    [jss2, ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Agricultural Science']],
    [ss1,  ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Economics']],
  ]) {
    for (const name of names) {
      await prisma.subject.upsert({ where: { name_classId: { name, classId: cls.id } }, update: {}, create: { name, classId: cls.id } })
    }
  }

  // Session + Terms
  let session = await prisma.session.findUnique({ where: { name: '2024/2025' } })
  if (!session) {
    session = await prisma.session.create({
      data: {
        name: '2024/2025',
        isCurrent: true,
        terms: { create: [
          { name: 'First Term',  isCurrent: true  },
          { name: 'Second Term', isCurrent: false },
          { name: 'Third Term',  isCurrent: false },
        ]}
      },
      include: { terms: true }
    })
  }
  const firstTerm = session.terms?.find(t => t.name === 'First Term')
    || await prisma.term.findFirst({ where: { sessionId: session.id, name: 'First Term' } })

  console.log(`✅  Session: ${session.name}, Active term: ${firstTerm.name}`)

  // Optional fees
  const [ptaFee, examFee] = await Promise.all([
    prisma.optionalFee.upsert({ where: { name: 'PTA Levy' }, update: {}, create: { name: 'PTA Levy', amount: 2000, description: 'Parent-Teacher Association levy' } }),
    prisma.optionalFee.upsert({ where: { name: 'Exam Fee' }, update: {}, create: { name: 'Exam Fee', amount: 3500, description: 'End-of-term examination fee' } }),
  ])

  // Students
  const studentData = [
    { admissionNumber: 'SCH/2024/0001', name: 'Amaka Obi',     parentPhone: '+2348012345678', classId: jss1.id },
    { admissionNumber: 'SCH/2024/0002', name: 'Emeka Nwosu',   parentPhone: '+2348023456789', classId: jss1.id },
    { admissionNumber: 'SCH/2024/0003', name: 'Fatima Bello',  parentPhone: '+2348034567890', classId: jss2.id },
    { admissionNumber: 'SCH/2024/0004', name: 'Tunde Adeyemi', parentPhone: '+2348045678901', classId: ss1.id  },
  ]
  const students = []
  for (const d of studentData) {
    const s = await prisma.student.upsert({ where: { admissionNumber: d.admissionNumber }, update: {}, create: d })
    students.push(s)
  }

  // School fee payments (termId-based)
  const payAmounts = [45000, 25000, 45000, 30000]
  for (let i = 0; i < students.length; i++) {
    const existing = await prisma.payment.findFirst({ where: { studentId: students[i].id, termId: firstTerm.id } })
    if (!existing) {
      await prisma.payment.create({
        data: { studentId: students[i].id, termId: firstTerm.id, amountPaid: payAmounts[i], paymentMethod: i % 2 === 0 ? 'transfer' : 'cash', recordedById: null }
      })
    }
  }

  // Optional fee assignments (termId-based)
  for (const student of students) {
    for (const fee of [ptaFee, examFee]) {
      await prisma.optionalFeeAssign.upsert({
        where: { studentId_optionalFeeId_termId: { studentId: student.id, optionalFeeId: fee.id, termId: firstTerm.id } },
        update: {},
        create: { studentId: student.id, optionalFeeId: fee.id, termId: firstTerm.id }
      })
    }
  }

  // Sample results
  const jss1Subjects = await prisma.subject.findMany({ where: { classId: jss1.id } })
  const scores = [78, 65, 82, 55, 90]
  for (const student of [students[0], students[1]]) {
    for (let i = 0; i < jss1Subjects.length; i++) {
      await prisma.result.upsert({
        where: { studentId_subjectId_termId: { studentId: student.id, subjectId: jss1Subjects[i].id, termId: firstTerm.id } },
        update: {},
        create: { studentId: student.id, subjectId: jss1Subjects[i].id, termId: firstTerm.id, score: scores[i % scores.length] }
      })
    }
  }

  console.log('\n🎉 Done!')
  console.log('   Admin:   admin@school.ng / admin123')
  console.log('   Teacher: teacher@school.ng / teacher123')
  console.log('   Student: SCH/2024/0001 + Amaka')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
