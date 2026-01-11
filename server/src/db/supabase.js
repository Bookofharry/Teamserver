import { createClient } from '@supabase/supabase-js'
import logger from '../utils/logger.js'

let supabaseAdmin

export const getSupabaseAdmin = () => {
  if (supabaseAdmin) return supabaseAdmin

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return supabaseAdmin
}

function serializeError(err) {
  if (!err) return null
  try {
    // Capture common Supabase error fields and fallback to JSON string
    const out = {
      message: err.message || err.error_description || err.details || null,
      code: err.code || err.status || null,
      hint: err.hint || null,
      details: err.details || null,
    }
    // include any enumerable own properties
    Object.getOwnPropertyNames(err).forEach((k) => {
      if (!(k in out)) out[k] = err[k]
    })
    return out
  } catch (e) {
    return { raw: String(err) }
  }
}

export const handleSupabaseError = (res, error, message = 'Database error') => {
  const ser = serializeError(error)
  logger.error({ supabase: ser, message }, 'Supabase error')
  // Avoid leaking internal error details in production responses
  if (res.headersSent) return null
  return res.status(500).json({ error: { code: 'database_error', message } })
}
