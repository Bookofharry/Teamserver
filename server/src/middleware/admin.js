import { sanitizeEmail } from '../utils/sanitize.js'

const parseList = (value) =>
  String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

const ADMIN_EMAILS = new Set(parseList(process.env.ADMIN_EMAILS))

export const requireAdmin = (req, res, next) => {
  const email = sanitizeEmail(req.auth?.email || '')
  if (!email || ADMIN_EMAILS.size === 0 || !ADMIN_EMAILS.has(email)) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Admin access required' } })
  }
  return next()
}
