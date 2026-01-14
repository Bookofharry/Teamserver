import { getSupabaseAdmin } from '../db/supabase.js'
import { sanitizeEmail, sanitizeName } from '../utils/sanitize.js'
import { normalizePlan } from '../utils/plan.js'

export const mapWorkspaceRow = (row) => ({
  id: row.id,
  name: row.name,
  ownerId: row.owner_id,
  createdAt: row.created_at,
})

export const mapProfileRow = (profile) => ({
  id: profile?.id ?? 'unknown',
  name: profile?.full_name || profile?.name || 'Unknown',
  email: profile?.email || '',
  avatar: profile?.avatar_url || null,
  twoFactorEnabled: false,
  plan: normalizePlan(profile?.plan) || (profile?.is_subscribed ? 'premium' : 'free'),
  isSubscribed: normalizePlan(profile?.plan) ? normalizePlan(profile?.plan) !== 'free' : profile?.is_subscribed ?? false,
  lastWorkspaceId: profile?.last_workspace_id ?? null,
  status: profile?.status || null,
  statusEmoji: profile?.status_emoji || null,
  hasSeenOnboarding: profile?.has_seen_onboarding ?? false,
})

export const mapNoteRow = (row, profile) => {
  const fallbackProfile = profile || { id: row.updated_by_id, email: '' }
  return {
    id: row.id,
    title: row.title,
    body: row.body || '',
    workspaceId: row.workspace_id,
    groupId: row.group_id,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isPinned: row.is_pinned ?? false,
    isPublic: row.is_public ?? false,
    publicSlug: row.public_slug ?? null,
    publicPublishedAt: row.public_published_at ?? null,
    publicExpiresAt: row.public_expires_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: mapProfileRow(fallbackProfile),
    deletedAt: row.deleted_at ?? null,
  }
}

export const ensureProfile = async (auth) => {
  const supabase = getSupabaseAdmin()
  const email = sanitizeEmail(auth.email || '')
  const metadataName = auth.userMetadata?.full_name || auth.userMetadata?.name || ''
  const fallbackName = email ? email.split('@')[0] : 'New user'
  const fullName = sanitizeName(metadataName) || sanitizeName(fallbackName)

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: auth.userId, email, full_name: fullName }, { onConflict: 'id' })

  if (error) {
    throw error
  }
}

export const requireWorkspaceMember = async (req, res, workspaceId) => {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.auth.userId)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: { code: 'database_error', message: 'Failed to check access' } })
    return null
  }
  if (!data) {
    res.status(403).json({ error: { code: 'forbidden', message: 'Access denied' } })
    return null
  }
  return data
}

export const requireWorkspaceRole = async (req, res, workspaceId, allowedRoles) => {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.auth.userId)
    .maybeSingle()

  if (error) {
    res.status(500).json({ error: { code: 'database_error', message: 'Failed to verify permissions' } })
    return null
  }

  if (!data || !allowedRoles.includes(data.role)) {
    res.status(403).json({ error: { code: 'forbidden', message: 'Insufficient permissions' } })
    return null
  }

  return data
}
