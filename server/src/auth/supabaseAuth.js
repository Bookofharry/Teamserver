import jwt from 'jsonwebtoken'
import logger from '../utils/logger.js'
import { getSupabaseAdmin } from '../db/supabase.js'

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

export const createAuthToken = async ({ userId, email, role = 'authenticated', name, sessionVersion = 0 }) => {
  const secretValue = getJwtSecret()
  if (!secretValue) {
    throw new Error('AUTH_JWT_SECRET is not set')
  }

  const ttlSeconds = getAuthTokenTtlSeconds()
  const payload = { email, role, name, sessionVersion }

  return new Promise((resolve, reject) => {
    jwt.sign(payload, secretValue, {
      algorithm: 'HS256',
      expiresIn: ttlSeconds,
      issuer: getJwtIssuer(),
      audience: getJwtAudience(),
      subject: userId
    }, (err, token) => {
      if (err) reject(err);
      else resolve(token);
    });
  });
}

export const verifySupabaseToken = async (token) => {
  const secretValue = getJwtSecret()
  if (!secretValue) {
    throw new Error('AUTH_JWT_SECRET is not set')
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, secretValue, {
      algorithms: ['HS256'],
      issuer: getJwtIssuer(),
      audience: getJwtAudience()
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}

export const buildAuthCookieOptions = (payload) => {
  const isProd = process.env.NODE_ENV === 'production'
  const isVercel = !!process.env.VERCEL

  let sameSiteRaw = (process.env.AUTH_COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase()
  let sameSite = ['lax', 'strict', 'none'].includes(sameSiteRaw) ? sameSiteRaw : 'lax'

  let secure =
    process.env.AUTH_COOKIE_SECURE !== undefined
      ? process.env.AUTH_COOKIE_SECURE === 'true'
      : isProd

  if (isVercel) {
    sameSite = 'none'
    secure = true
  }

  let domain = process.env.AUTH_COOKIE_DOMAIN

  // Ignore domain config on Vercel to support Rewrite/Proxy setups.
  // When proxied, the cookie must be HostOnly (matching the frontend domain).

  if (isVercel) {
    domain = undefined
  }

  // If domain is explicitly set (e.g. for custom domains), strip protocol
  if (domain) {
    domain = domain.replace(/^https?:\/\//, '').split(':')[0]
  }

  // Handle 'exp' from payload (JWT expiration)
  let maxAge = undefined;
  if (payload?.exp) {
    const msRemaining = payload.exp * 1000 - Date.now();
    if (msRemaining > 0) {
      maxAge = msRemaining;
    }
  }

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    ...(domain ? { domain } : {}),
    ...(maxAge ? { maxAge } : {})
  }
}

export const getAuthCookieName = () => resolveAuthCookieName()

export const requireSupabaseAuth = async (req, res, next) => {
  try {
    const token = getAuthToken(req)

    if (!token) {
      // Quietly fail for no token (expected during logout/initial load)
      if (process.env.NODE_ENV !== 'production') {
        logger.debug({ path: req.path }, 'Auth missing token')
      }
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized' } })
    }

    const payload = await verifySupabaseToken(token)
    const supabase = getSupabaseAdmin()
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('session_version')
      .eq('id', payload.sub)
      .maybeSingle()

    if (profileError) {
      logger.warn({ error: profileError?.message || profileError }, 'Auth session version lookup failed')
      return res.status(500).json({ error: { code: 'auth_check_failed', message: 'Auth check failed' } })
    }

    const tokenSessionVersion = Number.parseInt(payload.sessionVersion ?? 0, 10) || 0
    const profileSessionVersion = profileRow?.session_version ?? 0
    if (!profileRow || profileSessionVersion !== tokenSessionVersion) {
      return res.status(401).json({
        error: {
          code: 'unauthorized',
          message: 'Session expired',
        },
      })
    }

    req.auth = {
      userId: payload.sub,
      email: payload.email || '',
      role: payload.role || 'authenticated',
      userMetadata: payload.name ? { full_name: payload.name } : {},
      appMetadata: {},
      sessionVersion: tokenSessionVersion,
    }
    return next()
  } catch (error) {
    // Standard error logging
    if (process.env.NODE_ENV !== 'production') {
      logger.warn({ name: error?.name, message: error?.message }, 'Auth token verification failed')
    }
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or expired token',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      }
    })
  }
}
