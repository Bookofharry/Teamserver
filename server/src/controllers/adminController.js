import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { normalizePlan } from '../utils/plan.js'
import { sanitizeText } from '../utils/sanitize.js'
import { parseBody } from '../utils/validation.js'
import { updateAdminUserPlanSchema } from '../dto/admin.js'
import { toAdminUserResponse } from '../dto/responses/admin.js'

const sendInvalid = (res, message) =>
  res.status(400).json({ error: { code: 'invalid_request', message } })

const normalizeAdminProfile = (row) => ({
  id: row.id,
  email: row.email || '',
  full_name: row.full_name || '',
  avatar_url: row.avatar_url || null,
  plan: normalizePlan(row.plan) || (row.is_subscribed ? 'premium' : 'free'),
  is_subscribed: row.is_subscribed ?? false,
  created_at: row.created_at || null,
})

export const listAdminUsers = async (_req, res) => {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, plan, is_subscribed, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load users')
  }

  res.json({ data: (data || []).map((row) => toAdminUserResponse(normalizeAdminProfile(row))) })
}

export const updateAdminUserPlan = async (req, res) => {
  const userId = sanitizeText(req.params.id || '')
  if (!userId) {
    return sendInvalid(res, 'Valid user id is required')
  }

  const input = parseBody(updateAdminUserPlanSchema, req, res)
  if (!input) return

  const plan = normalizePlan(input.plan)
  if (!['free', 'premium', 'premium_plus'].includes(plan)) {
    return sendInvalid(res, 'Valid plan is required')
  }
  const isSubscribed = plan !== 'free'

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('profiles')
    .update({ plan, is_subscribed: isSubscribed })
    .eq('id', userId)
    .select('id, email, full_name, avatar_url, plan, is_subscribed, created_at')
    .maybeSingle()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to update user plan')
  }

  if (!data) {
    return res.status(404).json({ error: { code: 'not_found', message: 'User not found' } })
  }

  res.json({ data: toAdminUserResponse(normalizeAdminProfile(data)) })
}
