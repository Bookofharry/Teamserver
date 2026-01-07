import crypto from 'crypto'
import { getAuthCookieName } from '../auth/supabaseAuth.js'

const resolveCsrfCookieName = () => (process.env.CSRF_COOKIE_NAME || 'teampad_csrf').trim()

const parseCookies = (cookieHeader = '') =>
  cookieHeader.split(';').reduce((acc, part) => {
    const trimmed = part.trim()
    if (!trimmed) return acc
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) return acc
    const key = trimmed.slice(0, eqIndex)
    const value = trimmed.slice(eqIndex + 1)
    acc[key] = decodeURIComponent(value)
    return acc
  }, {})

const buildCsrfCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production'
  const sameSiteRaw = (process.env.AUTH_COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase()
  const sameSite = ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax'
  const secure =
    process.env.AUTH_COOKIE_SECURE !== undefined
      ? process.env.AUTH_COOKIE_SECURE === 'true'
      : isProd
  return {
    httpOnly: false,
    secure,
    sameSite,
    path: '/',
  }
}

const createCsrfToken = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex')

export const ensureCsrfCookie = (req, res) => {
  const cookieHeader = req.headers.cookie || ''
  const cookies = parseCookies(cookieHeader)
  const name = resolveCsrfCookieName()
  const existing = cookies[name]
  if (existing) return existing
  const token = createCsrfToken()
  res.cookie(name, token, buildCsrfCookieOptions())
  return token
}

export const clearCsrfCookie = (res) => {
  res.clearCookie(resolveCsrfCookieName(), buildCsrfCookieOptions())
}

export const csrfMiddleware = (req, res, next) => {
  const method = req.method.toUpperCase()
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(method)
  const cookieHeader = req.headers.cookie || ''
  const cookies = parseCookies(cookieHeader)
  const csrfCookieName = resolveCsrfCookieName()
  const csrfToken = cookies[csrfCookieName]
  const authCookie = cookies[getAuthCookieName()]

  if (!safe && authCookie) {
    const headerToken = req.headers['x-csrf-token']
    if (!csrfToken || !headerToken || headerToken !== csrfToken) {
      return res
        .status(403)
        .json({ error: { code: 'csrf_failed', message: 'Invalid CSRF token' } })
    }
  }

  if (!csrfToken) {
    const token = createCsrfToken()
    res.cookie(csrfCookieName, token, buildCsrfCookieOptions())
  }

  return next()
}
