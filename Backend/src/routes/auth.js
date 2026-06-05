import { Router }      from 'express'
import bcrypt          from 'bcryptjs'
import jwt             from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { authenticate } from '../middleware/auth.js'
import { log }          from '../services/audit.service.js'

const router = Router()
const prisma = new PrismaClient()

router.post('/login', async (req, res) => {
  const { email, password, admissionNumber, firstName } = req.body

  // ── Student login ──────────────────────────────────────────────────────────
  if (admissionNumber) {
    if (!firstName) return res.status(400).json({ error: 'First name is required' })

    const student = await prisma.student.findUnique({
      where: { admissionNumber: admissionNumber.trim() },
      include: { class: true }
    })

    if (!student) return res.status(401).json({ error: 'Admission number not found' })

    const storedFirst = student.name.trim().split(/\s+/)[0].toLowerCase()
    if (storedFirst !== firstName.trim().toLowerCase()) {
      return res.status(401).json({ error: 'First name does not match our records' })
    }

    const token = jwt.sign(
      { id: student.id, role: 'STUDENT', name: student.name, admissionNumber: student.admissionNumber },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    )

    // Log student login (no userId — students aren't in User table)
    await prisma.auditLog.create({
      data: {
        userId:   null,
        userName: student.name,
        userRole: 'STUDENT',
        action:   'LOGIN',
        entity:   'Student',
        entityId: student.id,
        detail:   `Student "${student.name}" (${student.admissionNumber}) logged into portal`,
        ip:       req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null
      }
    })

    return res.json({
      token,
      user: {
        id:              student.id,
        name:            student.name,
        role:            'STUDENT',
        admissionNumber: student.admissionNumber,
        classId:         student.classId,
        className:       student.class.className
      }
    })
  }

  // ── Staff login ────────────────────────────────────────────────────────────
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { teacher: { include: { class: true } } }
  })

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  // Attach user to req so log() can read it
  req.user = { id: user.id, role: user.role, name: user.name }
  await log({ req, action: 'LOGIN', entity: 'User', entityId: user.id, detail: `${user.role} "${user.name}" logged in` })

  const { password: _, ...safeUser } = user
  res.json({ token, user: safeUser })
})

router.get('/me', authenticate, async (req, res) => {
  if (req.user.role === 'STUDENT') {
    const s = await prisma.student.findUnique({ where: { id: req.user.id }, include: { class: true } })
    return res.json({ ...req.user, className: s?.class.className })
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { teacher: { include: { class: true } } }
  })
  if (!user) return res.status(404).json({ error: 'User not found' })
  const { password: _, ...safe } = user
  res.json(safe)
})

export default router
