import { Router }      from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticate, adminOnly } from '../middleware/auth.js'

const router = Router()
const prisma = new PrismaClient()
router.use(authenticate, adminOnly)

// GET audit logs with optional filters
router.get('/', async (req, res) => {
  const { userId, entity, action, from, to, page = '1', limit = '50' } = req.query

  const where = {
    ...(userId && { userId }),
    ...(entity && { entity }),
    ...(action && { action }),
    ...(from || to) && {
      createdAt: {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to)   }),
      }
    }
  }

  const skip  = (parseInt(page) - 1) * parseInt(limit)
  const take  = parseInt(limit)

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.auditLog.count({ where })
  ])

  res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / take) })
})

// GET distinct actors (for filter dropdown)
router.get('/actors', async (_, res) => {
  const actors = await prisma.auditLog.groupBy({
    by: ['userId', 'userName', 'userRole'],
    orderBy: { userName: 'asc' }
  })
  res.json(actors)
})

export default router
