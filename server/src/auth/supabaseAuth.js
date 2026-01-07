import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose'
import logger from '../utils/logger.js'

const getJwtSecret = () => (process.env.SUPABASE_JWT_SECRET || '').trim()
const getSupabaseUrl = () => (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '')
const getJwtIssuer = () =>
  (process.env.SUPABASE_JWT_ISSUER || '').trim() || (getSupabaseUrl() ? `${getSupabaseUrl()}/auth/v1` : '')
const getJwtAudience = () => (process.env.SUPABASE_JWT_AUDIENCE || 'authenticated').trim()
const getJwksUrl = () => (process.env.SUPABASE_JWKS_URL || '').trim()
const getJwksApiKey = () =>
  (
    process.env.SUPABASE_JWKS_API_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    ''
  ).trim()
let remoteJwks
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

export const verifySupabaseToken = async (token) => {
  const header = decodeProtectedHeader(token)
  const algorithm = header?.alg
  const issuer = getJwtIssuer()
  const audience = getJwtAudience()
  const verifyOptions = {
    issuer: issuer || undefined,
    audience: audience || undefined,
  }

  if (!algorithm) {
    throw new Error('JWT algorithm is missing')
  }

  if (algorithm === 'RS256' || algorithm === 'ES256') {
    const supabaseUrl = getSupabaseUrl()
    const jwksUrl = getJwksUrl() || (supabaseUrl ? `${supabaseUrl}/auth/v1/keys` : '')
    if (!jwksUrl) {
      throw new Error('SUPABASE_URL or SUPABASE_JWKS_URL must be set for asymmetric tokens')
    }
    if (!remoteJwks) {
      const apiKey = getJwksApiKey()
      const options = apiKey
        ? { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` } }
        : undefined
      remoteJwks = createRemoteJWKSet(new URL(jwksUrl), options)
    }
    const { payload } = await jwtVerify(token, remoteJwks, {
      algorithms: ['RS256', 'ES256'],
      ...verifyOptions,
    })
    return payload
  }

  const secretValue = getJwtSecret()
  if (!secretValue) {
    throw new Error('SUPABASE_JWT_SECRET is not set')
  }
  const secret = new TextEncoder().encode(secretValue)
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'], ...verifyOptions })
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
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Missing token' } })
    }
    const payload = await verifySupabaseToken(token)
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      userMetadata: payload.user_metadata || {},
      appMetadata: payload.app_metadata || {},
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
