import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { ensureProfile, requireWorkspaceMember, requireWorkspaceRole } from './helpers.js'
import { isValidHexColor, sanitizeName, sanitizeText } from '../utils/sanitize.js'
import { parsePagination } from '../utils/pagination.js'
import { logEvent } from '../utils/events.js'
import { resolvePlanForUser } from '../utils/plan.js'
import { parseBody } from '../utils/validation.js'
import { createGroupSchema } from '../dto/groups.js'
import { toDeleteGroupResponse, toGroupResponse } from '../dto/responses/groups.js'

export const listGroups = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()
  const { from, to } = parsePagination(req, { defaultLimit: 20 })

  if (!(await requireWorkspaceMember(req, res, id))) return

  const { data: groupRows, error } = await supabase
    .from('groups')
    .select('id, workspace_id, name, color')
    .eq('workspace_id', id)
    .order('name')
    .range(from, to)

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load groups')
  }

  const { data: countRows, error: countError } = await supabase.rpc('get_group_note_counts', {
    p_workspace_id: id,
  })

  if (countError) {
    return handleSupabaseError(res, countError, 'Failed to load note counts')
  }

  const counts = new Map()
  ;(countRows || []).forEach((row) => {
    counts.set(row.group_id, Number(row.note_count) || 0)
  })

  const data = groupRows.map((group) =>
    toGroupResponse({
      id: group.id,
      workspaceId: group.workspace_id,
      name: group.name,
      color: group.color || '#0EA5E9',
      noteCount: counts.get(group.id) || 0,
    }),
  )

  res.json({ data })
}

export const createGroup = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  if (!(await requireWorkspaceMember(req, res, id))) return
  try {
    await ensureProfile(req.auth)
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const input = parseBody(createGroupSchema, req, res)
  if (!input) return

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('is_subscribed, plan')
    .eq('id', req.auth.userId)
    .maybeSingle()

  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load profile')
  }

  const authPlan = req.auth?.appMetadata?.plan || req.auth?.userMetadata?.plan
  const plan = resolvePlanForUser({
    profilePlan: profileRow?.plan,
    authPlan,
    isSubscribed: profileRow?.is_subscribed,
    email: req.auth.email,
    userId: req.auth.userId,
  })
  const groupLimit =
    plan === 'free' ? 5 :
    plan === 'premium' ? 20 :
    plan === 'premium_plus' ? 50 :
    null
  if (groupLimit) {
    const { count, error: countError } = await supabase
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', id)

    if (countError) {
      return handleSupabaseError(res, countError, 'Failed to verify group limits')
    }

    if ((count ?? 0) >= groupLimit) {
      return res.status(403).json({
        error: { code: 'limit_reached', message: 'Upgrade to Premium or Premium+ to create more collections.' },
      })
    }
  }

  const name = sanitizeName(input.name || '') || 'Untitled Collection'
  const color = sanitizeText(input.color || '')
  const safeColor = isValidHexColor(color) ? color : '#0EA5E9'

  const { data: groupRow, error } = await supabase
    .from('groups')
    .insert({ workspace_id: id, name, color: safeColor })
    .select('id, workspace_id, name, color')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to create group')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: id,
    action: 'collection.created',
    metadata: { name: groupRow.name },
  })

  res.status(201).json({
    data: toGroupResponse({
      id: groupRow.id,
      workspaceId: groupRow.workspace_id,
      name: groupRow.name,
      color: groupRow.color || '#0EA5E9',
      noteCount: 0,
    }),
  })
}

export const deleteGroup = async (req, res) => {
  const { id, groupId } = req.params
  const supabase = getSupabaseAdmin()
  const safeGroupId = sanitizeText(groupId || '')

  if (!safeGroupId) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'groupId is required' } })
  }

  const requesterRow = await requireWorkspaceRole(req, res, id, ['owner'])
  if (!requesterRow) return

  const { data: groupRow, error: groupError } = await supabase
    .from('groups')
    .select('id')
    .eq('workspace_id', id)
    .eq('id', safeGroupId)
    .maybeSingle()

  if (groupError) {
    return handleSupabaseError(res, groupError, 'Failed to load group')
  }

  if (!groupRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Group not found' } })
  }

  try {
    await ensureProfile(req.auth)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to sync profile')
  }

  const deletedAt = new Date().toISOString()
  const { error: notesError } = await supabase
    .from('notes')
    .update({ deleted_at: deletedAt, updated_at: deletedAt, updated_by_id: req.auth.userId })
    .eq('workspace_id', id)
    .eq('group_id', safeGroupId)
    .is('deleted_at', null)

  if (notesError) {
    return handleSupabaseError(res, notesError, 'Failed to archive notes')
  }

  const { error: deleteError } = await supabase.from('groups').delete().eq('id', safeGroupId)

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to delete group')
  }

  res.json({ data: toDeleteGroupResponse({ id: safeGroupId }) })
}
