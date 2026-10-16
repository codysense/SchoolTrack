import jwt from 'jsonwebtoken'

/**
 * Verify JWT and attach req.user to the request.
 * Works for all three roles: ADMIN, TEACHER, STUDENT
 */
export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Unauthorized — no token provided' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Only ADMIN role may proceed.
 * Use after authenticate().
 */
export function adminOnly(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

/**
 * ADMIN or TEACHER may proceed.
 * Use after authenticate().
 */
export function staffOnly(req, res, next) {
  if (!['ADMIN', 'TEACHER'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Staff access required' })
  }
  next()
}

/**
 * Only STUDENT role may proceed.
 * Used exclusively for the student portal routes.
 * Use after authenticate().
 */
export function studentOnly(req, res, next) {
  if (req.user?.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Student portal access only' })
  }
  next()
}
