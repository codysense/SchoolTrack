import { Router }      from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, adminOnly } from '../middleware/auth.js'
import { log }         from '../services/audit.service.js'

const router = Router()
const prisma = new PrismaClient()
router.use(authenticate)

// ── Fee Types ─────────────────────────────────────────────────────────────────

router.get('/types', async (_, res) => {
  const fees = await prisma.optionalFee.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { assigns: true } } }
  })
  res.json(fees)
})

router.post('/types', adminOnly, async (req, res) => {
  const { name, amount, description } = req.body
  try {
    const fee = await prisma.optionalFee.create({
      data: { name: name.trim(), amount: parseFloat(amount), description: description || null }
    })
    await log({ req, action: 'CREATE', entity: 'OptionalFee', entityId: fee.id, detail: `Created optional fee "${fee.name}" ₦${fee.amount}` })
    res.status(201).json(fee)
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'A fee with this name already exists' })
    throw e
  }
})

router.put('/types/:id', adminOnly, async (req, res) => {
  const { name, amount, description } = req.body
  const fee = await prisma.optionalFee.update({
    where: { id: req.params.id },
    data: { name: name.trim(), amount: parseFloat(amount), description: description || null }
  })
  await log({ req, action: 'UPDATE', entity: 'OptionalFee', entityId: fee.id, detail: `Updated optional fee "${fee.name}"` })
  res.json(fee)
})

router.delete('/types/:id', adminOnly, async (req, res) => {
  const fee = await prisma.optionalFee.findUnique({ where: { id: req.params.id } })
  await prisma.optionalFee.delete({ where: { id: req.params.id } })
  await log({ req, action: 'DELETE', entity: 'OptionalFee', entityId: req.params.id, detail: `Deleted optional fee "${fee?.name}"` })
  res.json({ success: true })
})

// ── Assignments ───────────────────────────────────────────────────────────────

router.get('/assigns', async (req, res) => {
  const { termId, studentId } = req.query
  const assigns = await prisma.optionalFeeAssign.findMany({
    where: {
      ...(termId    && { termId }),
      ...(studentId && { studentId })
    },
    include: {
      optionalFee: true,
      student:     { include: { class: true } },
      payments:    true,
      term:        { include: { session: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const enriched = assigns.map(a => {
    const paid    = a.payments.reduce((s, p) => s + p.amountPaid, 0)
    const balance = a.optionalFee.amount - paid
    return { ...a, paid, balance }
  })

  res.json(enriched)
})

// POST bulk-assign a fee to one or many students for a term
router.post('/assigns', adminOnly, async (req, res) => {
  const { studentIds, optionalFeeId, termId } = req.body

  if (!termId)          return res.status(400).json({ error: 'termId is required' })
  if (!optionalFeeId)   return res.status(400).json({ error: 'optionalFeeId is required' })
  if (!studentIds?.length) return res.status(400).json({ error: 'Select at least one student' })

  const ids = Array.isArray(studentIds) ? studentIds : [studentIds]

  const results = await Promise.allSettled(
    ids.map(studentId =>
      prisma.optionalFeeAssign.create({
        data: { studentId, optionalFeeId, termId },
        include: { optionalFee: true, student: true }
      })
    )
  )

  const created = results.filter(r => r.status === 'fulfilled').map(r => r.value)
  const skipped = results.filter(r => r.status === 'rejected').length

  if (created.length) {
    const fee = created[0].optionalFee
    await log({
      req, action: 'CREATE', entity: 'OptionalFeeAssign',
      detail: `Assigned "${fee.name}" to ${created.length} student(s) for termId ${termId}`,
      metadata: { optionalFeeId, termId, studentIds: created.map(c => c.studentId) }
    })
  }

  res.status(201).json({
    created, skipped,
    message: `Assigned to ${created.length} student(s)${skipped ? `, ${skipped} already assigned (skipped)` : ''}`
  })
})

router.delete('/assigns/:id', adminOnly, async (req, res) => {
  const assign = await prisma.optionalFeeAssign.findUnique({
    where: { id: req.params.id },
    include: { optionalFee: true, student: true }
  })
  await prisma.optionalFeeAssign.delete({ where: { id: req.params.id } })
  await log({ req, action: 'DELETE', entity: 'OptionalFeeAssign', entityId: req.params.id,
    detail: `Removed "${assign?.optionalFee.name}" from ${assign?.student.name}` })
  res.json({ success: true })
})

// ── Payments toward optional fees ─────────────────────────────────────────────

router.post('/payments', adminOnly, async (req, res) => {
  const { optionalFeeAssignId, studentId, amountPaid, paymentMethod, note } = req.body

  const assign = await prisma.optionalFeeAssign.findUnique({
    where: { id: optionalFeeAssignId },
    include: { optionalFee: true, payments: true, student: { include: { class: true } } }
  })
  if (!assign) return res.status(404).json({ error: 'Assignment not found' })

  const alreadyPaid = assign.payments.reduce((s, p) => s + p.amountPaid, 0)
  const remaining   = assign.optionalFee.amount - alreadyPaid
  if (parseFloat(amountPaid) > remaining + 0.01) {
    return res.status(400).json({ error: `Amount exceeds remaining balance of ₦${remaining.toFixed(2)}` })
  }

  const payment = await prisma.optionalFeePayment.create({
    data: {
      studentId,
      optionalFeeAssignId,
      amountPaid:   parseFloat(amountPaid),
      paymentMethod,
      note:         note || null,
      recordedById: req.user.id,
    },
    include: { optionalFeeAssign: { include: { optionalFee: true } } }
  })

  await log({
    req, action: 'CREATE', entity: 'OptionalFeePayment', entityId: payment.id,
    detail: `Recorded ₦${amountPaid} for "${assign.optionalFee.name}" — ${assign.student.name}`,
    metadata: { optionalFeeAssignId, studentId, amountPaid, paymentMethod }
  })

  res.status(201).json(payment)
})

export default router
