import { SignJWT, jwtVerify } from 'jose'
import logger from '../utils/logger.js'

const getJwtSecret = () => (process.env.AUTH_JWT_SECRET || '').trim()
const getJwtIssuer = () => (process.env.AUTH_JWT_ISSUER || 'teampad').trim()
const getJwtAudience = () => (process.env.AUTH_JWT_AUDIENCE || 'teampad').trim()
export const getAuthTokenTtlSeconds = () =>
  Number.parseInt(process.env.AUTH_JWT_TTL_SECONDS || String(60 * 60 * 24 * 7), 10)
const resolveAuthCookieName = () => (process.env.AUTH_COOKIE_NAME || 'teampad_session').trim()
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
const getAuthToken = (req) => {
  const cookieHeader = req.headers.cookie || ''
  const cookies = parseCookies(cookieHeader)
  const cookieToken = cookies[resolveAuthCookieName()]
  if (cookieToken) return cookieToken
  const header = req.headers.authorization
  if (!header) return null
  const [type, token] = header.split(' ')
  if (type !== 'Bearer' || !token) return null
  return token
}

export const createAuthToken = async ({ userId, email, role = 'authenticated', name }) => {
  const secretValue = getJwtSecret()
  if (!secretValue) {
    throw new Error('AUTH_JWT_SECRET is not set')
  }
  const secret = new TextEncoder().encode(secretValue)
  const ttlSeconds = getAuthTokenTtlSeconds()
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({ email, role, name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setIssuer(getJwtIssuer())
    .setAudience(getJwtAudience())
    .setSubject(userId)
    .setExpirationTime(now + ttlSeconds)
    .sign(secret)
}

export const verifySupabaseToken = async (token) => {
  const secretValue = getJwtSecret()
  if (!secretValue) {
    throw new Error('AUTH_JWT_SECRET is not set')
  }
  const secret = new TextEncoder().encode(secretValue)
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    issuer: getJwtIssuer(),
    audience: getJwtAudience(),
  })
  return payload
}

export const buildAuthCookieOptions = (payload) => {
  const isProd = process.env.NODE_ENV === 'production'
  const sameSiteRaw = (process.env.AUTH_COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase()
  const sameSite = ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax'
  const secure =
    process.env.AUTH_COOKIE_SECURE !== undefined
      ? process.env.AUTH_COOKIE_SECURE === 'true'
      : isProd
  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  }
  if (payload?.exp) {
    const maxAge = Math.max(payload.exp * 1000 - Date.now(), 0)
    if (maxAge > 0) {
      options.maxAge = maxAge
    }
  }
  return options
}

export const getAuthCookieName = () => resolveAuthCookieName()

export const requireSupabaseAuth = async (req, res, next) => {
  try {
    const token = getAuthToken(req)
    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn({ method: req.method, path: req.path }, 'Auth missing token for request')
      }
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Something went wrong — are you being sneaky?' } })
    }
    const payload = await verifySupabaseToken(token)
    req.auth = {
      userId: payload.sub,
      email: payload.email || '',
      role: payload.role || 'authenticated',
      userMetadata: payload.name ? { full_name: payload.name } : {},
      appMetadata: {},
    }
    return next()
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      logger.warn({ name: error?.name, message: error?.message }, 'Auth token verification failed')
    }
    const details =
      process.env.NODE_ENV !== 'production' ? { details: error?.message || 'Auth failed' } : {}
    return res
      .status(401)
      .json({ error: { code: 'unauthorized', message: 'Invalid or expired token', ...details } })
  }
}
