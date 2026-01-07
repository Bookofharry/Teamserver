import { getSupabaseAdmin } from '../db/supabase.js'
import logger from '../utils/logger.js'

const MAX_KEY_LENGTH = 128
const DEFAULT_TTL_DAYS = 7
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000
let lastCleanupAt = 0

const normalizeKey = (req) => {
  const raw = req.get('Idempotency-Key')
  if (!raw) return { key: null }
  const key = String(raw).trim()
  if (!key) return { key: null }
  if (key.length > MAX_KEY_LENGTH) {
    return { error: 'Idempotency-Key is too long.' }
  }
  return { key }
}

const recordResponse = async (supabase, recordId, statusCode, payload) => {
  if (!recordId) return
  const status = statusCode >= 200 && statusCode < 300 ? 'completed' : 'failed'
  await supabase
    .from('idempotency_keys')
    .update({
      status,
      status_code: statusCode,
      response: payload ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
}

const getTtlDays = () => {
  const raw = Number.parseInt(process.env.IDEMPOTENCY_TTL_DAYS || '', 10)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_DAYS
  return raw
}

const getExpiryIso = () => {
  const ttlDays = getTtlDays()
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString()
}

const cleanupIdempotency = async (supabase) => {
  const now = new Date().toISOString()
  const { error } = await supabase.from('idempotency_keys').delete().lt('expires_at', now)
  if (error) {
    logger.warn({ error: error?.message || error }, 'Idempotency cleanup failed')
  }
}

export const createIdempotencyMiddleware = (scope) => async (req, res, next) => {
  const { key, error } = normalizeKey(req)
  if (error) {
    return res.status(400).json({ error: { code: 'invalid_idempotency_key', message: error } })
  }
  if (!key) return next()

  const userId = req.auth?.userId
  if (!userId) return next()

  const supabase = getSupabaseAdmin()
  if (Date.now() - lastCleanupAt > CLEANUP_INTERVAL_MS) {
    lastCleanupAt = Date.now()
    cleanupIdempotency(supabase).catch(() => null)
  }
  const { data: existing, error: existingError } = await supabase
    .from('idempotency_keys')
    .select('id, status, status_code, response, expires_at')
    .eq('user_id', userId)
    .eq('scope', scope)
    .eq('idempotency_key', key)
    .maybeSingle()

  if (existingError) {
    logger.warn({ error: existingError?.message || existingError }, 'Idempotency lookup failed')
    return next()
  }

  if (existing) {
    if (existing.expires_at && new Date(existing.expires_at) < new Date()) {
      await supabase.from('idempotency_keys').delete().eq('id', existing.id)
    } else {
      if (existing.status === 'completed' && existing.response) {
        return res.status(existing.status_code || 200).json(existing.response)
      }
      if (existing.status === 'failed' && existing.response) {
        return res.status(existing.status_code || 400).json(existing.response)
      }
      return res.status(409).json({
        error: { code: 'idempotency_in_progress', message: 'Request is already processing.' },
      })
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('idempotency_keys')
    .insert({
      user_id: userId,
      scope,
      idempotency_key: key,
      status: 'processing',
      expires_at: getExpiryIso(),
    })
    .select('id')
    .single()

  if (insertError) {
    logger.warn({ error: insertError?.message || insertError }, 'Idempotency reserve failed')
    return next()
  }

  let responsePayload
  const originalJson = res.json.bind(res)
  const originalSend = res.send.bind(res)

  res.json = (body) => {
    responsePayload = body
    return originalJson(body)
  }
  res.send = (body) => {
    responsePayload = body
    return originalSend(body)
  }

  res.on('finish', () => {
    recordResponse(supabase, inserted?.id, res.statusCode || 200, responsePayload).catch((err) => {
      logger.warn({ error: err?.message || err }, 'Idempotency store failed')
    })
  })

  return next()
}
