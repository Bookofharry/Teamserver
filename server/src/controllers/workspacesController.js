import crypto from 'crypto'
import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import {
  ensureProfile,
  mapProfileRow,
  mapWorkspaceRow,
  requireWorkspaceMember,
  requireWorkspaceRole,
} from './helpers.js'
import { isValidEmail, sanitizeEmail, sanitizeName } from '../utils/sanitize.js'
import { parsePagination } from '../utils/pagination.js'
import { sendWorkspaceInviteEmail } from '../utils/email.js'
import { isHigherPlan, normalizePlan, resolvePlanForUser } from '../utils/plan.js'
import { logEvent } from '../utils/events.js'
import logger from '../utils/logger.js'
import { publishChatRoomEvent } from '../utils/ablyChat.js'
import { parseBody } from '../utils/validation.js'
import { createInviteSchema, createWorkspaceSchema, updateWorkspaceSchema } from '../dto/workspaces.js'
import { toChatMessageResponse } from '../dto/responses/chat.js'
import {
  toAcceptInviteResponse,
  toDeleteWorkspaceResponse,
  toInviteDeclineResponse,
  toInviteDetailsResponse,
  toInviteResponse,
  toRemoveMemberResponse,
  toWorkspaceMemberResponse,
  toWorkspaceResponse,
} from '../dto/responses/workspaces.js'

const sendInvalid = (res, message) =>
  res.status(400).json({ error: { code: 'invalid_request', message } })

const normalizeMemberRow = (row) => {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.created_at,
    user: mapProfileRow(profile || { id: row.user_id }),
  }
}

const normalizeInviter = (profile) => mapProfileRow(profile || {})

export const listWorkspaces = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { from, to } = parsePagination(req, { defaultLimit: 20 })

  try {
    await ensureProfile(req.auth)
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', req.auth.userId)
    .order('created_at', { ascending: true })
    .range(from, to)

  if (memberError) {
    return handleSupabaseError(res, memberError, 'Failed to load workspaces')
  }

  const workspaceIds = memberRows.map((row) => row.workspace_id)
  if (workspaceIds.length === 0) {
    return res.json({ data: [] })
  }

  const { data: workspaceRows, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id, name, owner_id, created_at')
    .in('id', workspaceIds)
    .order('created_at', { ascending: true })

  if (workspaceError) {
    return handleSupabaseError(res, workspaceError, 'Failed to load workspaces')
  }

  res.json({ data: workspaceRows.map((row) => toWorkspaceResponse(mapWorkspaceRow(row))) })
}

export const createWorkspace = async (req, res) => {
  const supabase = getSupabaseAdmin()

  try {
    await ensureProfile(req.auth)
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to sync profile')
  }

  const input = parseBody(createWorkspaceSchema, req, res)
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
  const resolvedPlan = resolvePlanForUser({
    profilePlan: profileRow?.plan,
    authPlan,
    isSubscribed: profileRow?.is_subscribed,
    email: req.auth.email,
    userId: req.auth.userId,
  })
  const normalizedProfilePlan = normalizePlan(profileRow?.plan) || 'free'
  if (isHigherPlan(resolvedPlan, normalizedProfilePlan)) {
    await supabase
      .from('profiles')
      .update({ plan: resolvedPlan })
      .eq('id', req.auth.userId)
  }

  const workspaceLimit = resolvedPlan === 'free' ? 1 : resolvedPlan === 'premium' ? 3 : null

  const { count: workspaceCount, error: countError } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', req.auth.userId)

  if (countError) {
    return handleSupabaseError(res, countError, 'Failed to check workspace limit')
  }

  if (workspaceLimit && (workspaceCount ?? 0) >= workspaceLimit) {
    return res.status(403).json({
      error: { code: 'plan_limit', message: 'Upgrade to Premium or Premium+ to add more workspaces.' },
    })
  }

  const name = sanitizeName(input.name || '')

  const { data: workspaceRow, error: workspaceError } = await supabase
    .rpc('create_workspace_with_defaults', {
      p_name: name,
      p_owner_id: req.auth.userId,
    })
    .single()

  if (workspaceError) {
    logger.error(
      { error: workspaceError, userId: req.auth.userId, name },
      'Workspace creation RPC failed',
    )
    return handleSupabaseError(res, workspaceError, 'Failed to create workspace')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: workspaceRow.id,
    action: 'workspace.created',
    metadata: { name: workspaceRow.name },
  })

  res.status(201).json({ data: toWorkspaceResponse(mapWorkspaceRow(workspaceRow)) })
}

export const updateWorkspace = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  const memberRow = await requireWorkspaceRole(req, res, id, ['owner', 'admin'])
  if (!memberRow) return

  const input = parseBody(updateWorkspaceSchema, req, res)
  if (!input) return

  const name = sanitizeName(input.name)
  if (!name) {
    return sendInvalid(res, 'name is required')
  }

  const { data: workspaceRow, error: updateError } = await supabase
    .from('workspaces')
    .update({ name })
    .eq('id', id)
    .select('id, name, owner_id, created_at')
    .maybeSingle()

  if (updateError) {
    return handleSupabaseError(res, updateError, 'Failed to update workspace')
  }

  if (!workspaceRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Workspace not found' } })
  }

  res.json({ data: toWorkspaceResponse(mapWorkspaceRow(workspaceRow)) })
}

export const deleteWorkspace = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  const memberRow = await requireWorkspaceRole(req, res, id, ['owner'])
  if (!memberRow) return

  const { data: deletedRow, error: deleteError } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to delete workspace')
  }

  if (!deletedRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Workspace not found' } })
  }

  res.json({ data: toDeleteWorkspaceResponse({ id: deletedRow.id }) })
}

export const listWorkspaceMembers = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()
  const { from, to } = parsePagination(req, { defaultLimit: 20 })

  if (!(await requireWorkspaceMember(req, res, id))) return

  const { data: memberRows, error } = await supabase
    .from('workspace_members')
    .select('id, role, user_id, workspace_id, created_at, profiles(id, full_name, email, avatar_url, status, status_emoji)')
    .eq('workspace_id', id)
    .order('created_at', { ascending: true })
    .range(from, to)

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load members')
  }

  res.json({ data: memberRows.map((row) => toWorkspaceMemberResponse(normalizeMemberRow(row))) })
}

export const getInviteInfo = async (req, res) => {
  const { token } = req.params
  const supabase = getSupabaseAdmin()

  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, email, role, token, expires_at, created_by, created_at')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load invite')
  }

  if (!invite) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Invite not found' } })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: { code: 'invalid_token', message: 'Invite expired' } })
  }

  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', invite.workspace_id)
    .maybeSingle()

  if (workspaceError) {
    return handleSupabaseError(res, workspaceError, 'Failed to load workspace')
  }

  const { data: inviterRow, error: inviterError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', invite.created_by)
    .maybeSingle()

  if (inviterError) {
    return handleSupabaseError(res, inviterError, 'Failed to load inviter')
  }

  res.json({
    data: toInviteDetailsResponse({
      id: invite.id,
      workspaceId: invite.workspace_id,
      workspaceName: workspaceRow?.name || 'Workspace',
      email: invite.email,
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expires_at,
      createdAt: invite.created_at,
      inviter: inviterRow
        ? normalizeInviter(inviterRow)
        : { id: invite.created_by, name: 'TeamPad', email: '' },
    }),
  })
}

export const listWorkspaceInvites = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()
  const { from, to } = parsePagination(req, { defaultLimit: 20 })

  const requesterRow = await requireWorkspaceRole(req, res, id, ['owner', 'admin'])
  if (!requesterRow) return

  const now = new Date().toISOString()
  const { error: cleanupError } = await supabase
    .from('workspace_invites')
    .delete()
    .eq('workspace_id', id)
    .lt('expires_at', now)

  if (cleanupError) {
    logger.warn({ error: cleanupError?.message || cleanupError }, 'Failed to cleanup expired workspace invites')
  }

  const { data: inviteRows, error } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, email, role, token, expires_at, created_by, created_at')
    .eq('workspace_id', id)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load invites')
  }

  res.json({
    data: inviteRows.map((invite) =>
      toInviteResponse({
        id: invite.id,
        workspaceId: invite.workspace_id,
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expiresAt: invite.expires_at,
        createdBy: invite.created_by,
        createdAt: invite.created_at,
      }),
    ),
  })
}

export const listMyInvites = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { from, to } = parsePagination(req, { defaultLimit: 20 })
  const email = sanitizeEmail(req.auth.email || '')

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Valid email is required' } })
  }

  const now = new Date().toISOString()
  const { error: cleanupError } = await supabase
    .from('workspace_invites')
    .delete()
    .eq('email', email)
    .lt('expires_at', now)

  if (cleanupError) {
    logger.warn({ error: cleanupError?.message || cleanupError }, 'Failed to cleanup expired invites for user')
  }

  const { data: invites, error } = await supabase
    .from('workspace_invites')
    .select('id, workspace_id, email, role, token, expires_at, created_by, created_at')
    .eq('email', email)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load invites')
  }

  const workspaceIds = invites.map((invite) => invite.workspace_id)
  const inviterIds = invites.map((invite) => invite.created_by).filter(Boolean)

  const { data: workspaces, error: workspaceError } = workspaceIds.length
    ? await supabase.from('workspaces').select('id, name').in('id', workspaceIds)
    : { data: [], error: null }

  if (workspaceError) {
    return handleSupabaseError(res, workspaceError, 'Failed to load workspaces')
  }

  const { data: inviters, error: inviterError } = inviterIds.length
    ? await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', inviterIds)
    : { data: [], error: null }

  if (inviterError) {
    return handleSupabaseError(res, inviterError, 'Failed to load inviters')
  }

  const workspaceMap = new Map((workspaces || []).map((row) => [row.id, row.name]))
  const inviterMap = new Map((inviters || []).map((row) => [row.id, row]))

  res.json({
    data: invites.map((invite) =>
      toInviteDetailsResponse({
        id: invite.id,
        workspaceId: invite.workspace_id,
        workspaceName: workspaceMap.get(invite.workspace_id) || 'Workspace',
        email: invite.email,
        role: invite.role,
        token: invite.token,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        inviter: invite.created_by ? normalizeInviter(inviterMap.get(invite.created_by)) : undefined,
      }),
    ),
  })
}

export const declineInvite = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { token } = req.params

  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load invite')
  }

  if (!invite) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Invite not found' } })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: { code: 'invalid_token', message: 'Invite expired' } })
  }

  const authEmail = sanitizeEmail(req.auth.email || '')
  if (!authEmail || authEmail !== invite.email) {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Invite email does not match signed-in user' } })
  }

  const { error: deleteError } = await supabase
    .from('workspace_invites')
    .delete()
    .eq('id', invite.id)

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to decline invite')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: invite.workspace_id,
    action: 'invite.declined',
    metadata: { inviteId: invite.id, email: invite.email },
  })

  res.json({ data: toInviteDeclineResponse({ workspaceId: invite.workspace_id, email: invite.email }) })
}

export const removeWorkspaceMember = async (req, res) => {
  const { id, userId } = req.params
  const supabase = getSupabaseAdmin()

  const requesterRow = await requireWorkspaceRole(req, res, id, ['owner', 'admin'])
  if (!requesterRow) return

  const { data: targetRow, error: targetError } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('workspace_id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (targetError) {
    return handleSupabaseError(res, targetError, 'Failed to load member')
  }

  if (!targetRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Member not found' } })
  }

  if (targetRow.role === 'owner') {
    if (requesterRow.role !== 'owner') {
      return res.status(403).json({ error: { code: 'forbidden', message: 'Only owners can remove owners' } })
    }

    const { count, error: countError } = await supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', id)
      .eq('role', 'owner')

    if (countError) {
      return handleSupabaseError(res, countError, 'Failed to verify owners')
    }

    if ((count || 0) <= 1) {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'Cannot remove the last owner' } })
    }
  }

  if (targetRow.role === 'admin' && requesterRow.role !== 'owner') {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Only owners can remove admins' } })
  }

  const { error: deleteError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', id)
    .eq('user_id', userId)

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to remove member')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: id,
    action: 'member.removed',
    metadata: { targetUserId: userId, role: targetRow.role },
  })

  // -- NOTIFICATION START --
  // Fetch profiles for message construction
  const { data: adminProfile } = await supabase.from('profiles').select('full_name, email').eq('id', req.auth.userId).maybeSingle()
  const { data: targetProfile } = await supabase.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()

  if (adminProfile && targetProfile) {
    const adminName = adminProfile.full_name || adminProfile.email?.split('@')[0] || 'Admin'
    const targetName = targetProfile.full_name || targetProfile.email?.split('@')[0] || 'Member'
    const body = `${targetName} was removed by ${adminName}`

    const { data: systemRow } = await supabase
      .from('workspace_messages')
      .insert({
        workspace_id: id,
        sender_id: req.auth.userId,
        body,
        message_type: 'system',
      })
      .select('id, workspace_id, sender_id, body, message_type, created_at, edited_at, deleted_at')
      .maybeSingle()

    if (systemRow) {
      const payload = toChatMessageResponse({
        id: systemRow.id,
        workspaceId: systemRow.workspace_id,
        body: systemRow.body || '',
        messageType: systemRow.message_type,
        createdAt: systemRow.created_at,
        editedAt: systemRow.edited_at ?? null,
        deletedAt: systemRow.deleted_at ?? null,
        sender: mapProfileRow(adminProfile || { id: req.auth.userId }),
        attachments: [],
        reactions: [],
        mentions: [],
      })
      publishChatRoomEvent(`workspace:${id}`, { type: 'message.created', message: payload }).catch(() => { })
    }
  }
  // -- NOTIFICATION END --

  res.json({ data: toRemoveMemberResponse({ workspaceId: id, userId }) })
}

export const leaveWorkspace = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  const { data: memberRow, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', id)
    .eq('user_id', req.auth.userId)
    .maybeSingle()

  if (memberError) {
    return handleSupabaseError(res, memberError, 'Failed to check membership')
  }

  if (!memberRow) {
    return res.status(404).json({ error: { code: 'not_member', message: 'Not a member of this workspace' } })
  }

  if (memberRow.role === 'owner') {
    const { count, error: countError } = await supabase
      .from('workspace_members')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', id)
      .eq('role', 'owner')

    if (countError) {
      return handleSupabaseError(res, countError, 'Failed to verify owners')
    }

    if ((count || 0) <= 1) {
      return res.status(400).json({
        error: {
          code: 'last_owner',
          message: 'The last owner cannot leave. Delete the workspace or transfer ownership first.',
        },
      })
    }
  }

  const { error: deleteError } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', id)
    .eq('user_id', req.auth.userId)

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to leave workspace')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: id,
    action: 'member.left',
    metadata: { role: memberRow.role },
  })

  // -- NOTIFICATION START --
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', req.auth.userId)
    .maybeSingle()

  if (profileRow) {
    const displayName = profileRow.full_name || profileRow.email?.split('@')[0] || 'Member'
    const body = `${displayName} left the workspace`

    const { data: systemRow } = await supabase
      .from('workspace_messages')
      .insert({
        workspace_id: id,
        sender_id: req.auth.userId,
        body,
        message_type: 'system',
      })
      .select('id, workspace_id, sender_id, body, message_type, created_at, edited_at, deleted_at')
      .maybeSingle()

    if (systemRow) {
      const payload = toChatMessageResponse({
        id: systemRow.id,
        workspaceId: systemRow.workspace_id,
        body: systemRow.body || '',
        messageType: systemRow.message_type,
        createdAt: systemRow.created_at,
        editedAt: systemRow.edited_at ?? null,
        deletedAt: systemRow.deleted_at ?? null,
        sender: mapProfileRow(profileRow),
        attachments: [],
        reactions: [],
        mentions: [],
      })
      publishChatRoomEvent(`workspace:${id}`, { type: 'message.created', message: payload }).catch(() => { })
    }
  }
  // -- NOTIFICATION END --

  res.json({ data: { left: true, workspaceId: id } })
}

export const createInvite = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  const requesterRow = await requireWorkspaceRole(req, res, id, ['owner', 'admin'])
  if (!requesterRow) return

  const input = parseBody(createInviteSchema, req, res)
  if (!input) return

  const email = sanitizeEmail(input.email || '')
  if (!email || !isValidEmail(email)) {
    return sendInvalid(res, 'Valid email is required')
  }
  const requesterEmail = sanitizeEmail(req.auth.email || '')
  if (requesterEmail && requesterEmail === email) {
    return sendInvalid(res, 'You cannot invite yourself')
  }

  const { data: existingMember, error: memberCheckError } = await supabase
    .from('workspace_members')
    .select('user_id, profiles!inner(email)')
    .eq('workspace_id', id)
    .eq('profiles.email', email)
    .maybeSingle()

  if (memberCheckError) {
    return handleSupabaseError(res, memberCheckError, 'Failed to verify member email')
  }

  if (existingMember) {
    return res.status(409).json({ error: { code: 'already_member', message: 'User is already a member' } })
  }

  const { data: existingInvite, error: inviteCheckError } = await supabase
    .from('workspace_invites')
    .select('id')
    .eq('workspace_id', id)
    .eq('email', email)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (inviteCheckError) {
    return handleSupabaseError(res, inviteCheckError, 'Failed to verify existing invites')
  }

  if (existingInvite) {
    return res.status(409).json({ error: { code: 'invite_exists', message: 'Invite already pending' } })
  }

  const roleInput = typeof input.role === 'string' ? input.role.toLowerCase() : 'member'
  const allowedRoles = requesterRow.role === 'owner' ? ['owner', 'admin', 'member'] : ['admin', 'member']
  if (!allowedRoles.includes(roleInput)) {
    return sendInvalid(res, 'Invalid role')
  }

  const invite = {
    workspace_id: id,
    email,
    role: roleInput,
    token: `invite_${crypto.randomUUID()}`,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_by: req.auth.userId,
  }

  const { data, error } = await supabase
    .from('workspace_invites')
    .insert(invite)
    .select('id, workspace_id, email, role, token, expires_at, created_by, created_at')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to create invite')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: id,
    action: 'invite.sent',
    metadata: { email: data.email, role: data.role },
  })

  let workspaceName = 'TeamPad workspace'
  const { data: workspaceRow, error: workspaceError } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  if (workspaceError) {
    logger.warn({ error: workspaceError?.message || workspaceError }, 'Failed to load workspace name for invite')
  } else if (workspaceRow?.name) {
    workspaceName = sanitizeName(workspaceRow.name) || workspaceName
  }

  let inviterName = sanitizeName(req.auth.userMetadata?.full_name || req.auth.userMetadata?.name || '')
  if (!inviterName) {
    const { data: inviterRow, error: inviterError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', req.auth.userId)
      .maybeSingle()

    if (inviterError) {
      logger.warn({ error: inviterError?.message || inviterError }, 'Failed to load inviter profile for invite')
    } else {
      const fallbackEmail = sanitizeEmail(inviterRow?.email || '')
      inviterName =
        sanitizeName(inviterRow?.full_name || '') ||
        (fallbackEmail ? sanitizeName(fallbackEmail.split('@')[0]) : '')
    }
  }

  if (!inviterName) {
    const fallbackEmail = sanitizeEmail(req.auth.email || '')
    inviterName = fallbackEmail ? sanitizeName(fallbackEmail.split('@')[0]) : 'Someone'
  }

  const appUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '')
  const inviteUrl = appUrl ? `${appUrl}/invite/${data.token}` : null

  if (inviteUrl) {
    if (process.env.NODE_ENV !== 'production') {
      logger.info({ email: data.email, workspaceId: id }, 'Invite link generated')
    }
  } else {
    logger.warn({ email: data.email, workspaceId: id }, 'Invite link missing APP_URL')
  }

  try {
    const emailResult = await sendWorkspaceInviteEmail({
      to: data.email,
      workspaceName,
      inviterName,
      role: data.role,
      token: data.token,
    })
    if (!emailResult.sent) {
      logger.warn({ reason: emailResult.reason || 'unknown' }, 'Invite email skipped')
    } else {
      logger.info(
        { email: data.email, workspaceId: id, messageId: emailResult.messageId },
        'Invite email sent',
      )
    }
  } catch (emailError) {
    logger.error({ error: emailError?.message || emailError }, 'Invite email failed')
  }

  res.status(201).json({
    data: toInviteResponse({
      id: data.id,
      workspaceId: data.workspace_id,
      email: data.email,
      role: data.role,
      token: data.token,
      expiresAt: data.expires_at,
      createdBy: data.created_by,
      createdAt: data.created_at,
    }),
  })
}

export const acceptInvite = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { token } = req.params

  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load invite')
  }

  if (!invite) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Invite not found' } })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(400).json({ error: { code: 'invalid_token', message: 'Invite expired' } })
  }

  const authEmail = sanitizeEmail(req.auth.email || '')
  if (!authEmail || authEmail !== invite.email) {
    return res
      .status(403)
      .json({ error: { code: 'forbidden', message: 'Invite email does not match signed-in user' } })
  }

  try {
    await ensureProfile(req.auth)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to sync profile')
  }

  const { data: existingMember, error: existingMemberError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', req.auth.userId)
    .maybeSingle()

  if (existingMemberError) {
    return handleSupabaseError(res, existingMemberError, 'Failed to check membership')
  }

  const { error: membershipError } = await supabase.from('workspace_members').upsert(
    {
      workspace_id: invite.workspace_id,
      user_id: req.auth.userId,
      role: invite.role,
    },
    { onConflict: 'workspace_id,user_id' },
  )

  if (membershipError) {
    return handleSupabaseError(res, membershipError, 'Failed to accept invite')
  }

  await supabase.from('workspace_invites').delete().eq('id', invite.id)

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: invite.workspace_id,
    action: 'invite.accepted',
    metadata: { inviteId: invite.id, role: invite.role },
  })

  if (!existingMember) {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, plan, is_subscribed')
      .eq('id', req.auth.userId)
      .maybeSingle()

    const displayName = profileRow?.full_name || profileRow?.email?.split('@')[0] || 'A member'
    const body = `${displayName} joined the workspace`

    const { data: systemRow, error: systemError } = await supabase
      .from('workspace_messages')
      .insert({
        workspace_id: invite.workspace_id,
        sender_id: req.auth.userId,
        body,
        message_type: 'system',
      })
      .select('id, workspace_id, sender_id, body, message_type, created_at, edited_at, deleted_at')
      .single()

    if (systemError) {
      logger.warn({ error: systemError?.message || systemError }, 'Failed to create join message')
    } else if (systemRow) {
      const payload = toChatMessageResponse({
        id: systemRow.id,
        workspaceId: systemRow.workspace_id,
        body: systemRow.body || '',
        messageType: systemRow.message_type,
        createdAt: systemRow.created_at,
        editedAt: systemRow.edited_at ?? null,
        deletedAt: systemRow.deleted_at ?? null,
        sender: mapProfileRow(profileRow || { id: req.auth.userId }),
        attachments: [],
        reactions: [],
        mentions: [],
      })
      const publishResult = await publishChatRoomEvent(`workspace:${invite.workspace_id}`, {
        type: 'message.created',
        message: payload,
      })
      if (!publishResult.sent) {
        logger.warn({ reason: publishResult.reason }, 'Join message publish skipped')
      }
    }
  }

  res.json({
    data: toAcceptInviteResponse({
      workspaceId: invite.workspace_id,
      member: {
        id: `wm_${invite.workspace_id}_${req.auth.userId}`,
        userId: req.auth.userId,
        role: invite.role,
      },
    }),
  })
}
