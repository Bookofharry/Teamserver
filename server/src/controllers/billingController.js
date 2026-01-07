import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { ensureProfile } from './helpers.js'
import { sanitizeText } from '../utils/sanitize.js'
import { parseBody } from '../utils/validation.js'

const sendInvalid = (res, message) =>
  res.status(400).json({ error: { code: 'invalid_request', message } })

import { normalizePlan } from '../utils/plan.js'
import { createUpgradeIntentSchema } from '../dto/billing.js'
import { toUpgradeIntentResponse } from '../dto/responses/billing.js'

export const createUpgradeIntent = async (req, res) => {
  const supabase = getSupabaseAdmin()

  try {
    await ensureProfile(req.auth)
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const input = parseBody(createUpgradeIntentSchema, req, res)
  if (!input) return

  const plan = normalizePlan(input.plan)
  if (!['premium', 'premium_plus'].includes(plan)) {
    return sendInvalid(res, 'Valid plan is required')
  }

  const source = sanitizeText(input.source || '').slice(0, 80) || null

  const planCandidates = plan === 'premium' ? ['premium', 'plus'] : [plan]
  const { data: existing, error: existingError } = await supabase
    .from('upgrade_intents')
    .select('id, plan, status, created_at')
    .eq('user_id', req.auth.userId)
    .in('plan', planCandidates)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .maybeSingle()

  if (existingError) {
    return handleSupabaseError(res, existingError, 'Failed to check upgrade request')
  }

  if (existing) {
    const normalizedExistingPlan = normalizePlan(existing.plan) || existing.plan
    return res.json({
      data: toUpgradeIntentResponse({
        id: existing.id,
        plan: normalizedExistingPlan,
        status: existing.status,
        createdAt: existing.created_at,
        alreadyPending: true,
      }),
    })
  }

  const { data, error } = await supabase
    .from('upgrade_intents')
    .insert({
      user_id: req.auth.userId,
      plan,
      source,
      status: 'pending',
    })
    .select('id, plan, status, created_at')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to record upgrade request')
  }

  res.status(201).json({
    data: toUpgradeIntentResponse({
      id: data.id,
      plan: normalizePlan(data.plan) || data.plan,
      status: data.status,
      createdAt: data.created_at,
      alreadyPending: false,
    }),
  })
}
