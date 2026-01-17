import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { mapProfileRow, requireWorkspaceRole } from './helpers.js'
import { sanitizeText } from '../utils/sanitize.js'

const clampDays = (value) => {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return 7
  return Math.min(Math.max(parsed, 1), 90)
}

const clampLimit = (value) => {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return 50
  return Math.min(Math.max(parsed, 1), 200)
}

const getProfilesMap = async (supabase, userIds) => {
  if (!userIds.length) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, plan, is_subscribed')
    .in('id', userIds)

  if (error) throw error
  return new Map((data || []).map((row) => [row.id, row]))
}

const safeCount = async (query, res, message) => {
  const { count, error } = await query
  if (error) {
    handleSupabaseError(res, error, message)
    return null
  }
  return count ?? 0
}

export const getWorkspaceAnalytics = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = sanitizeText(req.params.id || '')
  if (!workspaceId) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Workspace is required' } })
  }

  if (!(await requireWorkspaceRole(req, res, workspaceId, ['owner', 'admin']))) return

  const days = clampDays(req.query.days)
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const startIso = start.toISOString()

  const totalsPromises = Promise.all([
    safeCount(
      supabase.from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      res,
      'Failed to load members count',
    ),
    safeCount(
      supabase.from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null),
      res,
      'Failed to load notes count',
    ),
    safeCount(
      supabase.from('workspace_messages')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      res,
      'Failed to load messages count',
    ),
    safeCount(
      supabase.from('workspace_invites')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      res,
      'Failed to load invites count',
    ),
  ])

  const activityPromises = Promise.all([
    safeCount(
      supabase.from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', startIso)
        .is('deleted_at', null),
      res,
      'Failed to load notes created',
    ),
    safeCount(
      supabase.from('notes')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('updated_at', startIso)
        .is('deleted_at', null),
      res,
      'Failed to load notes updated',
    ),
    safeCount(
      supabase.from('workspace_messages')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', startIso),
      res,
      'Failed to load messages sent',
    ),
    safeCount(
      supabase.from('workspace_invites')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', startIso),
      res,
      'Failed to load invites sent',
    ),
    safeCount(
      supabase.from('workspace_members')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('created_at', startIso),
      res,
      'Failed to load members joined',
    ),
    safeCount(
      supabase.from('event_logs')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('action', 'invite.accepted')
        .gte('created_at', startIso),
      res,
      'Failed to load invites accepted',
    ),
  ])

  const totals = await totalsPromises
  const activity = await activityPromises
  if (!totals || !activity) return
  if (totals.some((value) => value === null) || activity.some((value) => value === null)) return

  res.json({
    data: {
      window: {
        days,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totals: {
        members: totals[0],
        notes: totals[1],
        messages: totals[2],
        invites: totals[3],
      },
      activity: {
        notesCreated: activity[0],
        notesUpdated: activity[1],
        messagesSent: activity[2],
        invitesSent: activity[3],
        membersJoined: activity[4],
        invitesAccepted: activity[5],
      },
    },
  })
}

export const listWorkspaceAuditLogs = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = sanitizeText(req.params.id || '')
  if (!workspaceId) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Workspace is required' } })
  }

  if (!(await requireWorkspaceRole(req, res, workspaceId, ['owner', 'admin']))) return

  const limit = clampLimit(req.query.limit)
  const actionFilter = sanitizeText(req.query.action || '')

  let query = supabase
    .from('event_logs')
    .select('id, user_id, workspace_id, action, metadata, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (actionFilter) {
    query = query.eq('action', actionFilter)
  }

  const { data: rows, error } = await query
  if (error) {
    return handleSupabaseError(res, error, 'Failed to load audit logs')
  }

  const actorIds = Array.from(new Set((rows || []).map((row) => row.user_id).filter(Boolean)))
  let profilesMap = new Map()
  try {
    profilesMap = await getProfilesMap(supabase, actorIds)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load audit actors')
  }

  const data = (rows || []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    action: row.action,
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
    actor: row.user_id ? mapProfileRow(profilesMap.get(row.user_id)) : null,
  }))

  res.json({ data })
}
