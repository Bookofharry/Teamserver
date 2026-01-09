import crypto from 'crypto'
import { getAuthCookieName } from '../auth/supabaseAuth.js'

const resolveCsrfCookieName = () => (process.env.CSRF_COOKIE_NAME || 'teampad_csrf').trim()
const getCsrfSecret = () => (process.env.CSRF_SECRET || process.env.SUPABASE_JWT_SECRET || '').trim()
const getCsrfTtlSeconds = () => {
  const raw = process.env.CSRF_TOKEN_TTL_SECONDS
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60
}

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

const hashAuthToken = (authToken) => crypto.createHash('sha256').update(authToken).digest('hex')

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  return Buffer.from(padded, 'base64').toString('utf8')
}

const signCsrfPayload = (payload) => {
  const secret = getCsrfSecret()
  if (!secret) return null
  const encoded = toBase64Url(JSON.stringify(payload))
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest()
  return `${encoded}.${toBase64Url(signature)}`
}

const verifyCsrfToken = (token, authToken) => {
  const secret = getCsrfSecret()
  if (!secret) return false
  if (!token) return false
  const [encoded, signature] = token.split('.')
  if (!encoded || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest()
  const expectedBase64 = toBase64Url(expected)
  if (expectedBase64.length !== signature.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(expectedBase64), Buffer.from(signature))) return false
  let payload
  try {
    payload = JSON.parse(fromBase64Url(encoded))
  } catch (error) {
    return false
  }
  if (!payload || typeof payload.exp !== 'number') return false
  if (payload.exp <= Math.floor(Date.now() / 1000)) return false
  if (authToken) {
    const authHash = hashAuthToken(authToken)
    if (!payload.ah || payload.ah !== authHash) return false
  }
  return true
}

const issueCsrfToken = (authToken) => {
  const token = signCsrfPayload({
    v: 1,
    ah: authToken ? hashAuthToken(authToken) : null,
    exp: Math.floor(Date.now() / 1000) + getCsrfTtlSeconds(),
    nonce: createCsrfToken(),
  })
  if (!token) {
    throw new Error('CSRF_SECRET or SUPABASE_JWT_SECRET must be set')
  }
  return token
}

export const ensureCsrfCookie = (req, res) => {
  const cookieHeader = req.headers.cookie || ''
  const cookies = parseCookies(cookieHeader)
  const authToken = cookies[getAuthCookieName()]
  const token = issueCsrfToken(authToken)
  res.setHeader('X-CSRF-Token', token)
  const name = resolveCsrfCookieName()
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
  const authCookie = cookies[getAuthCookieName()]

  if (!safe && authCookie) {
    const headerToken = req.headers['x-csrf-token']
    if (!headerToken || !verifyCsrfToken(headerToken, authCookie)) {
      return res
        .status(403)
        .json({ error: { code: 'csrf_failed', message: 'Invalid CSRF token' } })
    }
  }

  return next()
}
