import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * log({ req, action, entity, entityId, detail, metadata })
 *
 * Call this after every CREATE / UPDATE / DELETE / LOGIN.
 * Never throws — audit failure should never break the main operation.
 *
 * @param {object} opts
 * @param {import('express').Request} opts.req   - Express request (has req.user)
 * @param {'CREATE'|'UPDATE'|'DELETE'|'LOGIN'|'REMIND'} opts.action
 * @param {string}  opts.entity    - e.g. 'Student', 'Payment', 'Result'
 * @param {string}  [opts.entityId]
 * @param {string}  [opts.detail]  - plain-English summary
 * @param {object}  [opts.metadata] - full payload (stored as JSON)
 */
export async function log({ req, action, entity, entityId, detail, metadata }) {
  try {
    const user     = req?.user
    const userName = user?.name  || 'System'
    const userRole = user?.role  || 'SYSTEM'
    const userId   = (user?.role === 'ADMIN' || user?.role === 'TEACHER') ? user.id : null
    const ip       = req?.headers?.['x-forwarded-for']?.split(',')[0] || req?.socket?.remoteAddress || null

    await prisma.auditLog.create({
      data: {
        userId,
        userName,
        userRole,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        detail,
        metadata: metadata ?? undefined,
        ip,
      }
    })
  } catch (err) {
    // Never let audit failure crash the main request
    console.error('[AuditLog] Failed to write:', err.message)
  }
}
