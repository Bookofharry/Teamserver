import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { ensureProfile, mapProfileRow } from './helpers.js'
import {
  buildAuthCookieOptions,
  getAuthCookieName,
  verifySupabaseToken,
} from '../auth/supabaseAuth.js'
import { clearCsrfCookie } from '../middleware/csrf.js'
import { isValidEmail, sanitizeEmail, sanitizeName, sanitizeText } from '../utils/sanitize.js'
import { isHigherPlan, resolvePlanForUser } from '../utils/plan.js'
import { parseBody } from '../utils/validation.js'
import { checkEmailSchema, createSessionSchema, updateMeSchema } from '../dto/auth.js'
import { toCheckEmailResponse, toClearSessionResponse, toSessionResponse, toUserResponse } from '../dto/responses/auth.js'

const sendInvalid = (res, message) =>
  res.status(400).json({ error: { code: 'invalid_request', message } })

export const getMe = async (req, res) => {
  const supabase = getSupabaseAdmin()

  try {
    await ensureProfile(req.auth)
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, is_subscribed, plan')
    .eq('id', req.auth.userId)
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load profile')
  }

  res.json({ data: toUserResponse(mapProfileRow(data)) })
}

export const updateMe = async (req, res) => {
  const supabase = getSupabaseAdmin()

  try {
    await ensureProfile(req.auth)
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const input = parseBody(updateMeSchema, req, res)
  if (!input) return
  const hasName = Object.prototype.hasOwnProperty.call(input, 'name')
  const hasAvatar = Object.prototype.hasOwnProperty.call(input, 'avatar')

  const updates = {}
  if (hasName) {
    const fullName = sanitizeName(input.name)
    if (!fullName) {
      return sendInvalid(res, 'name is required')
    }
    updates.full_name = fullName
  }
  if (hasAvatar) {
    const avatar = sanitizeText(input.avatar)
    updates.avatar_url = avatar || null
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.auth.userId)
    .select('id, email, full_name, avatar_url, is_subscribed, plan')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to update profile')
  }

  res.json({ data: toUserResponse(mapProfileRow(data)) })
}

export const createSession = async (req, res) => {
  const input = parseBody(createSessionSchema, req, res)
  if (!input) return
  const accessToken = (input.accessToken || input.token || '').trim()
  if (!accessToken) {
    return sendInvalid(res, 'accessToken is required')
  }

  let payload
  try {
    payload = await verifySupabaseToken(accessToken)
  } catch (error) {
    return res
      .status(401)
      .json({ error: { code: 'unauthorized', message: 'Invalid or expired token' } })
  }

  const authPayload = {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    userMetadata: payload.user_metadata || {},
    appMetadata: payload.app_metadata || {},
  }
  try {
    await ensureProfile(authPayload)
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const supabase = getSupabaseAdmin()
  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('plan, is_subscribed')
    .eq('id', payload.sub)
    .maybeSingle()

  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load profile')
  }

  const authPlan = payload.app_metadata?.plan || payload.user_metadata?.plan
  const resolvedPlan = resolvePlanForUser({
    profilePlan: profileRow?.plan,
    authPlan,
    isSubscribed: profileRow?.is_subscribed,
    email: payload.email,
    userId: payload.sub,
  })
  if (isHigherPlan(resolvedPlan, profileRow?.plan)) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ plan: resolvedPlan })
      .eq('id', payload.sub)
    if (updateError) {
      return handleSupabaseError(res, updateError, 'Failed to update profile plan')
    }
  }

  const cookieOptions = buildAuthCookieOptions(payload)
  res.cookie(getAuthCookieName(), accessToken, cookieOptions)
  return res.json({
    data: toSessionResponse({
      userId: payload.sub,
      email: payload.email,
    }),
  })
}

export const clearSession = async (_req, res) => {
  const cookieOptions = buildAuthCookieOptions()
  res.clearCookie(getAuthCookieName(), cookieOptions)
  clearCsrfCookie(res)
  return res.json({ data: toClearSessionResponse({ cleared: true }) })
}

export const checkEmail = async (req, res) => {
  const input = parseBody(checkEmailSchema, req, res)
  if (!input) return
  const email = sanitizeEmail(input.email || '')

  if (!email || !isValidEmail(email)) {
    return sendInvalid(res, 'Valid email is required')
  }
  const delayMs = Number.parseInt(process.env.AUTH_CHECK_EMAIL_DELAY_MS || '250', 10)
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  const supabase = getSupabaseAdmin()
  let authUserExists = false
  const admin = supabase.auth?.admin
  if (admin && typeof admin.getUserByEmail === 'function') {
    const { data: authData, error: authError } = await admin.getUserByEmail(email)
    if (authError) {
      if (!/not found/i.test(authError.message || '')) {
        return handleSupabaseError(res, authError, 'Failed to check email')
      }
    } else if (authData?.user?.id) {
      authUserExists = true
    }
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()
  if (error) {
    return handleSupabaseError(res, error, 'Failed to check email')
  }
  return res.json({ data: toCheckEmailResponse({ exists: authUserExists || Boolean(data?.id) }) })
}
