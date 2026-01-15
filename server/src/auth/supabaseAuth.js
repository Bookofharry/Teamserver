import jwt from 'jsonwebtoken'
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
  // DEBUG: Fingerprint the secret for consistency check
  console.log(`[Auth Debug] Signing Token. Secret Fingerprint: Len=${secretValue.length}, Start="${secretValue.slice(0, 3)}..."`);

  const ttlSeconds = getAuthTokenTtlSeconds()
  const payload = { email, role, name }

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
  // DEBUG: Fingerprint the secret during verify
  console.log(`[Auth Debug] Verifying Token. Secret Fingerprint: Len=${secretValue.length}, Start="${secretValue.slice(0, 3)}..."`);

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

  // Ignore domain config on Vercel (Prod/Preview/Dev) to support Rewrite/Proxy setups.
  // When proxied, the cookie must be HostOnly (matching the frontend domain), 
  // so setting it to the backend domain explicitly would cause rejection.
  if (isVercel) {
    domain = undefined
  }

  if (domain) {
    domain = domain.replace(/^https?:\/\//, '').split(':')[0]
  }

  // Handle 'exp' from payload (which is seconds since epoch for JWT)
  let maxAge = undefined;
  if (payload?.exp) {
    const msRemaining = payload.exp * 1000 - Date.now();
    if (msRemaining > 0) {
      maxAge = msRemaining;
    }
  }

  // If no exp in payload, use default TTL for cookie
  /*
  const options = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    ...(domain ? { domain } : {}),
  }
  if (maxAge) options.maxAge = maxAge;
  */

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
    console.log(`[Auth Debug] Path: ${req.path} | CookieHeader: ${!!req.headers.cookie} | TokenFound: ${!!token}`);

    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        logger.warn({
          method: req.method,
          path: req.path,
          headers: req.headers
        }, '[DEBUG] Auth missing token - responding 401');
      }
      console.log(`[DEBUG] requireSupabaseAuth FAILED for ${req.path}. No token found.`);
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized' } })
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
    console.error(`[Auth Debug] Verification Failed: ${error.message}`, error);
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
