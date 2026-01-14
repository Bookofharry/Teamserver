import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { ensureProfile, mapProfileRow } from './helpers.js'
import {
  buildAuthCookieOptions,
  createAuthToken,
  getAuthTokenTtlSeconds,
  getAuthCookieName,
} from '../auth/supabaseAuth.js'
import { clearCsrfCookie } from '../middleware/csrf.js'
import { isValidEmail, sanitizeEmail, sanitizeName, sanitizeText } from '../utils/sanitize.js'
import { isHigherPlan, resolvePlanForUser } from '../utils/plan.js'
import { parseBody } from '../utils/validation.js'
import {
  checkEmailSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  signupRequestSchema,
  signupVerifySchema,
  updateMeSchema,
  forgotPasswordSchema,
} from '../dto/auth.js'
import {
  toCheckEmailResponse,
  toClearSessionResponse,
  toSessionResponse,
  toUserResponse,
} from '../dto/responses/auth.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import { sendSignupOtpEmail } from '../utils/email.js'
import logger from '../utils/logger.js'

const OTP_TTL_MS = 10 * 60 * 1000
const OTP_COOLDOWN_MS = 60 * 1000

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
    .select('id, email, full_name, avatar_url, is_subscribed, plan, last_workspace_id, status, status_emoji, has_seen_onboarding')
    .eq('id', req.auth.userId)
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load profile')
  }

  res.setHeader('Cache-Control', 'no-store')
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
  if (input.lastWorkspaceId !== undefined) {
    updates.last_workspace_id = input.lastWorkspaceId || null
  }

  if (input.status !== undefined) {
    updates.status = input.status || null
  }
  if (input.statusEmoji !== undefined) {
    updates.status_emoji = input.statusEmoji || null
  }
  if (input.hasSeenOnboarding !== undefined) {
    updates.has_seen_onboarding = Boolean(input.hasSeenOnboarding)
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', req.auth.userId)
    .select('id, email, full_name, avatar_url, is_subscribed, plan, last_workspace_id, status, status_emoji, has_seen_onboarding')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to update profile')
  }

  res.json({ data: toUserResponse(mapProfileRow(data)) })
}

export const signup = async (req, res) => {
  const input = parseBody(signupSchema, req, res)
  if (!input) return
  const email = sanitizeEmail(input.email || '')
  const name = sanitizeName(input.name || '')
  if (!email || !isValidEmail(email)) {
    return sendInvalid(res, 'Valid email is required')
  }
  if (!input.password || input.password.length < 8) {
    return sendInvalid(res, 'Password must be at least 8 characters')
  }

  const supabase = getSupabaseAdmin()
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('email', email)
    .maybeSingle()
  if (userError) {
    return handleSupabaseError(res, userError, 'Failed to check existing users')
  }

  const userId = existingUser?.id || crypto.randomUUID()

  if (existingUser?.password_hash) {
    return res.status(409).json({ error: { code: 'account_exists', message: 'Account already exists' } })
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  if (existingUser) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId)
    if (updateError) {
      return handleSupabaseError(res, updateError, 'Failed to set password')
    }
  } else {
    const { error: insertError } = await supabase
      .from('users')
      .insert({ id: userId, email, password_hash: passwordHash })
    if (insertError) {
      return handleSupabaseError(res, insertError, 'Failed to create user')
    }
  }

  try {
    await ensureProfile({ userId, email, userMetadata: { full_name: name } })
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const token = await createAuthToken({ userId, email, name })
  const cookieOptions = buildAuthCookieOptions({
    exp: Math.floor(Date.now() / 1000) + getAuthTokenTtlSeconds(),
  })
  res.cookie(getAuthCookieName(), token, cookieOptions)
  return res.json({ data: toSessionResponse({ userId, email }) })
}

export const requestSignupOtp = async (req, res) => {
  const input = parseBody(signupRequestSchema, req, res)
  if (!input) return
  const email = sanitizeEmail(input.email || '')
  if (!email || !isValidEmail(email)) {
    return sendInvalid(res, 'Valid email is required')
  }

  const supabase = getSupabaseAdmin()
  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (userError) {
    return handleSupabaseError(res, userError, 'Failed to check existing users')
  }
  if (existingUser?.id) {
    return res.status(409).json({ error: { code: 'account_exists', message: 'Account already exists' } })
  }

  const { data: latestOtp, error: latestOtpError } = await supabase
    .from('signup_otps')
    .select('id, created_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latestOtpError) {
    return handleSupabaseError(res, latestOtpError, 'Failed to verify signup code status')
  }
  if (latestOtp?.created_at) {
    const createdAt = new Date(latestOtp.created_at).getTime()
    if (Number.isFinite(createdAt) && Date.now() - createdAt < OTP_COOLDOWN_MS) {
      return res.status(429).json({
        error: { code: 'rate_limited', message: 'Please wait before requesting another code.' },
      })
    }
  }

  await supabase.from('signup_otps').delete().eq('email', email)

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

  const { error: insertError } = await supabase
    .from('signup_otps')
    .insert({ email, code, expires_at: expiresAt })
  if (insertError) {
    return handleSupabaseError(res, insertError, 'Failed to create signup code')
  }

  const emailResult = await sendSignupOtpEmail({ to: email, code })
  if (!emailResult?.sent) {
    logger.warn({ email, reason: emailResult?.reason }, 'Signup OTP email failed to send')
    await supabase.from('signup_otps').delete().eq('email', email)
    return res.status(500).json({ error: { code: 'email_failed', message: 'Failed to send email code' } })
  }
  return res.json({ data: { sent: true } })
}

export const verifySignupOtp = async (req, res) => {
  const input = parseBody(signupVerifySchema, req, res)
  if (!input) return
  const email = sanitizeEmail(input.email || '')
  const name = sanitizeName(input.name || '')
  if (!email || !isValidEmail(email)) {
    return sendInvalid(res, 'Valid email is required')
  }

  const supabase = getSupabaseAdmin()
  const { data: otpRow, error: otpError } = await supabase
    .from('signup_otps')
    .select('id, code, expires_at')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (otpError) {
    return handleSupabaseError(res, otpError, 'Failed to verify signup code')
  }
  if (!otpRow || otpRow.code !== input.code) {
    return res.status(400).json({ error: { code: 'invalid_code', message: 'Invalid verification code' } })
  }
  if (new Date(otpRow.expires_at).getTime() <= Date.now()) {
    return res.status(400).json({ error: { code: 'invalid_code', message: 'Verification code expired' } })
  }

  const { data: existingUser, error: userError } = await supabase
    .from('users')
    .select('id, password_hash')
    .eq('email', email)
    .maybeSingle()
  if (userError) {
    return handleSupabaseError(res, userError, 'Failed to check existing users')
  }
  if (existingUser?.password_hash) {
    return res.status(409).json({ error: { code: 'account_exists', message: 'Account already exists' } })
  }

  const userId = existingUser?.id || crypto.randomUUID()
  const passwordHash = await bcrypt.hash(input.password, 12)
  if (existingUser) {
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId)
    if (updateError) {
      return handleSupabaseError(res, updateError, 'Failed to set password')
    }
  } else {
    const { error: insertError } = await supabase
      .from('users')
      .insert({ id: userId, email, password_hash: passwordHash })
    if (insertError) {
      return handleSupabaseError(res, insertError, 'Failed to create user')
    }
  }

  try {
    await ensureProfile({ userId, email, userMetadata: { full_name: name } })
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  await supabase.from('signup_otps').delete().eq('email', email)

  const token = await createAuthToken({ userId, email, name })
  const cookieOptions = buildAuthCookieOptions({
    exp: Math.floor(Date.now() / 1000) + getAuthTokenTtlSeconds(),
  })
  res.cookie(getAuthCookieName(), token, cookieOptions)
  return res.json({ data: toSessionResponse({ userId, email }) })
}

export const login = async (req, res) => {
  const input = parseBody(loginSchema, req, res)
  if (!input) return
  const email = sanitizeEmail(input.email || '')
  if (!email || !isValidEmail(email)) {
    return sendInvalid(res, 'Valid email is required')
  }

  const supabase = getSupabaseAdmin()
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, email, password_hash')
    .eq('email', email)
    .maybeSingle()
  if (userError) {
    return handleSupabaseError(res, userError, 'Failed to load user')
  }
  if (!userRow) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid email or password' } })
  }
  if (!userRow.password_hash) {
    return res.status(403).json({ error: { code: 'password_not_set', message: 'Password not set' } })
  }

  const isValid = await bcrypt.compare(input.password, userRow.password_hash)
  if (!isValid) {
    return res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid email or password' } })
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('plan, is_subscribed, full_name')
    .eq('id', userRow.id)
    .maybeSingle()
  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load profile')
  }
  if (!profileRow) {
    try {
      await ensureProfile({ userId: userRow.id, email: userRow.email, userMetadata: {} })
    } catch (error) {
      return handleSupabaseError(res, error, 'Failed to sync profile')
    }
  }

  const resolvedPlan = resolvePlanForUser({
    profilePlan: profileRow?.plan,
    authPlan: null,
    isSubscribed: profileRow?.is_subscribed,
    email: userRow.email,
    userId: userRow.id,
  })
  if (isHigherPlan(resolvedPlan, profileRow?.plan)) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ plan: resolvedPlan })
      .eq('id', userRow.id)
    if (updateError) {
      return handleSupabaseError(res, updateError, 'Failed to update profile plan')
    }
  }

  const token = await createAuthToken({
    userId: userRow.id,
    email: userRow.email,
    name: profileRow?.full_name || '',
  })
  const cookieOptions = buildAuthCookieOptions({
    exp: Math.floor(Date.now() / 1000) + getAuthTokenTtlSeconds(),
  })
  res.cookie(getAuthCookieName(), token, cookieOptions)
  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', userRow.id)


}

export const clearSession = async (_req, res) => {
  const cookieOptions = buildAuthCookieOptions()
  res.clearCookie(getAuthCookieName(), cookieOptions)
  clearCsrfCookie(res)
  return res.json({ data: toClearSessionResponse({ cleared: true }) })
}

export const refreshSession = async (req, res) => {
  const name = req.auth?.userMetadata?.full_name || req.auth?.userMetadata?.name || ''
  const token = await createAuthToken({
    userId: req.auth.userId,
    email: req.auth.email,
    name,
  })
  const cookieOptions = buildAuthCookieOptions({
    exp: Math.floor(Date.now() / 1000) + getAuthTokenTtlSeconds(),
  })
  res.cookie(getAuthCookieName(), token, cookieOptions)
  res.setHeader('Cache-Control', 'no-store')
  return res.json({ data: toSessionResponse({ userId: req.auth.userId, email: req.auth.email }) })
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
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()
  if (error) {
    return handleSupabaseError(res, error, 'Failed to check email')
  }
  return res.json({ data: toCheckEmailResponse({ exists: Boolean(data?.id) }) })
}

export const forgotPassword = async (req, res) => {
  const input = parseBody(forgotPasswordSchema, req, res)
  if (!input) return
  const email = sanitizeEmail(input.email || '')
  if (!email || !isValidEmail(email)) {
    return sendInvalid(res, 'Valid email is required')
  }

  const supabase = getSupabaseAdmin()
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (userError) {
    return handleSupabaseError(res, userError, 'Failed to load user')
  }

  if (!userRow) {
    if (process.env.NODE_ENV !== 'production') {
      logger.info({ email }, 'Password reset requested for unknown email')
    }
    return res.json({ data: { sent: true } })
  }

  const token = `reset_${crypto.randomUUID()}`
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString()
  const { error: insertError } = await supabase
    .from('password_reset_tokens')
    .insert({ user_id: userRow.id, token, expires_at: expiresAt })
  if (insertError) {
    return handleSupabaseError(res, insertError, 'Failed to create reset token')
  }

  const emailResult = await sendPasswordResetEmail({ to: email, token })
  if (!emailResult?.sent) {
    logger.warn({ email, reason: emailResult?.reason }, 'Password reset email failed to send')
    await supabase.from('password_reset_tokens').delete().eq('token', token)
    return res.status(500).json({ error: { code: 'email_failed', message: 'Failed to send reset email' } })
  }
  return res.json({ data: { sent: true } })
}

export const resetPassword = async (req, res) => {
  const input = parseBody(resetPasswordSchema, req, res)
  if (!input) return
  if (!input.password || input.password.length < 8) {
    return sendInvalid(res, 'Password must be at least 8 characters')
  }

  const supabase = getSupabaseAdmin()
  const { data: tokenRow, error: tokenError } = await supabase
    .from('password_reset_tokens')
    .select('id, user_id, expires_at')
    .eq('token', input.token)
    .maybeSingle()
  if (tokenError) {
    return handleSupabaseError(res, tokenError, 'Failed to load reset token')
  }
  if (!tokenRow) {
    return res.status(400).json({ error: { code: 'invalid_token', message: 'Invalid or expired token' } })
  }
  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return res.status(400).json({ error: { code: 'invalid_token', message: 'Invalid or expired token' } })
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('id', tokenRow.user_id)
  if (updateError) {
    return handleSupabaseError(res, updateError, 'Failed to update password')
  }

  await supabase.from('password_reset_tokens').delete().eq('id', tokenRow.id)
  return res.json({ data: { updated: true } })
}
