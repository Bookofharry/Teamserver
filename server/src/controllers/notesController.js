import crypto from 'crypto'
import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { logEvent } from '../utils/events.js'
import { ensureProfile, mapNoteRow, mapProfileRow, requireWorkspaceMember, requireWorkspaceRole } from './helpers.js'
import { sanitizeBody, sanitizeTag, sanitizeText, sanitizeTitle } from '../utils/sanitize.js'
import { parsePagination } from '../utils/pagination.js'
import { resolvePlanForUser } from '../utils/plan.js'
import { parseBody } from '../utils/validation.js'
import { createNoteAttachmentSchema, createNoteSchema, updateNotePublicSchema, updateNoteSchema } from '../dto/notes.js'
import { toNoteAttachmentResponse, toNoteResponse, toNoteVersionDetailResponse, toNoteVersionResponse, toPublicNoteResponse } from '../dto/responses/notes.js'

const sendInvalid = (res, message) =>
  res.status(400).json({ error: { code: 'invalid_request', message } })

const getProfilesMap = async (supabase, userIds) => {
  if (!userIds.length) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .in('id', userIds)

  if (error) {
    throw error
  }

  const map = new Map()
  data.forEach((row) => map.set(row.id, row))
  return map
}

const ensureGroupExists = async (supabase, workspaceId, groupId) => {
  const { data, error } = await supabase
    .from('groups')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('id', groupId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data)
}

const mapPublicNoteRow = (row, profile) => ({
  id: row.id,
  title: row.title,
  body: row.body || '',
  updatedAt: row.updated_at,
  updatedBy: {
    id: profile?.id ?? row.updated_by_id ?? 'unknown',
    name: profile?.full_name || profile?.name || 'Unknown',
    avatar: profile?.avatar_url || null,
  },
  publicSlug: row.public_slug,
  publicExpiresAt: row.public_expires_at ?? null,
})

const mapAttachmentRow = (row, profile) => ({
  id: row.id,
  noteId: row.note_id,
  name: row.name,
  url: row.url,
  size: row.size ?? null,
  contentType: row.content_type ?? null,
  createdAt: row.created_at,
  createdBy: mapProfileRow(profile || { id: row.created_by_id }),
})

const mapVersionRow = (row, profile) => ({
  id: row.id,
  noteId: row.note_id,
  title: row.title || 'Untitled',
  createdAt: row.created_at,
  createdBy: mapProfileRow(profile || { id: row.created_by_id }),
})

const mapVersionDetailRow = (row, profile) => ({
  id: row.id,
  noteId: row.note_id,
  title: row.title || 'Untitled',
  body: row.body || '',
  tags: Array.isArray(row.tags) ? row.tags : [],
  createdAt: row.created_at,
  createdBy: mapProfileRow(profile || { id: row.created_by_id }),
})

const generatePublicSlug = () => `note_${crypto.randomBytes(12).toString('base64url')}`
const PUBLIC_NOTE_TTL_DAYS = 30

const saveNoteVersion = async (supabase, noteRow, userId) => {
  const { error } = await supabase
    .from('note_versions')
    .insert({
      note_id: noteRow.id,
      workspace_id: noteRow.workspace_id,
      group_id: noteRow.group_id,
      title: noteRow.title || 'Untitled',
      body: noteRow.body || '',
      tags: Array.isArray(noteRow.tags) ? noteRow.tags : [],
      created_by_id: userId,
    })
  if (error) throw error
}

export const listNotes = async (req, res) => {
  const { id } = req.params
  const groupId = sanitizeText(req.query?.groupId || '')
  const rawQuery = sanitizeText(req.query?.query || '')
  const searchQuery = rawQuery.replace(/[,%]/g, ' ').trim()
  const supabase = getSupabaseAdmin()
  const { from, to } = parsePagination(req, { defaultLimit: 50 })

  if (!(await requireWorkspaceMember(req, res, id))) return

  let query = supabase
    .from('notes')
    .select('id, title, body, workspace_id, group_id, tags, is_pinned, is_public, public_slug, public_published_at, public_expires_at, created_at, updated_at, updated_by_id')
    .eq('workspace_id', id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (groupId && !searchQuery) {
    query = query.eq('group_id', groupId)
  }

  if (searchQuery) {
    const ilike = `%${searchQuery}%`
    const filters = [`title.ilike.${ilike}`, `body.ilike.${ilike}`]
    if (!searchQuery.includes(' ')) {
      filters.push(`tags.cs.{${searchQuery}}`)
    }
    query = query.or(filters.join(','))
  }

  const { data: noteRows, error } = await query.range(from, to)

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load notes')
  }

  const updaterIds = Array.from(
    new Set(noteRows.map((note) => note.updated_by_id).filter(Boolean)),
  )

  let profilesMap = new Map()
  try {
    profilesMap = await getProfilesMap(supabase, updaterIds)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load note authors')
  }

  const data = noteRows.map((note) =>
    toNoteResponse(mapNoteRow(note, profilesMap.get(note.updated_by_id))),
  )
  res.json({ data })
}

export const createNote = async (req, res) => {
  const { id } = req.params
  const supabase = getSupabaseAdmin()

  if (!(await requireWorkspaceMember(req, res, id))) return

  try {
    await ensureProfile(req.auth)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to sync profile')
  }

  const input = parseBody(createNoteSchema, req, res)
  if (!input) return

  const groupId = sanitizeText(input.groupId)
  try {
    const exists = await ensureGroupExists(supabase, id, groupId)
    if (!exists) {
      return sendInvalid(res, 'groupId is invalid')
    }
  } catch (error) {
    return handleSupabaseError(res, error, 'Failed to validate group')
  }

  const { data: subscriptionRow, error: subscriptionError } = await supabase
    .from('profiles')
    .select('is_subscribed, plan')
    .eq('id', req.auth.userId)
    .maybeSingle()

  if (subscriptionError) {
    return handleSupabaseError(res, subscriptionError, 'Failed to load profile')
  }

  const authPlan = req.auth?.appMetadata?.plan || req.auth?.userMetadata?.plan
  const plan = resolvePlanForUser({
    profilePlan: subscriptionRow?.plan,
    authPlan,
    isSubscribed: subscriptionRow?.is_subscribed,
    email: req.auth.email,
    userId: req.auth.userId,
  })
  const noteLimit = plan === 'free' ? 8 : plan === 'premium' ? 200 : null

  if (noteLimit) {
    const { count, error: countError } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', id)
      .eq('group_id', groupId)
      .is('deleted_at', null)

    if (countError) {
      return handleSupabaseError(res, countError, 'Failed to verify note limits')
    }

    if ((count ?? 0) >= noteLimit) {
      return res.status(403).json({
        error: { code: 'limit_reached', message: 'Upgrade to Premium or Premium+ to add more notes in this collection.' },
      })
    }
  }

  const title = sanitizeTitle(input.title || '') || 'Untitled'
  const body = sanitizeBody(input.body || '')
  const tags = Array.isArray(input.tags)
    ? input.tags
        .filter((tag) => typeof tag === 'string')
        .map((tag) => sanitizeTag(tag))
        .filter(Boolean)
        .slice(0, 8)
    : []
  const uniqueTags = Array.from(new Set(tags))

  const { data: noteRow, error } = await supabase
    .from('notes')
    .insert({
      workspace_id: id,
      group_id: groupId,
      title,
      body,
      tags: uniqueTags,
      is_pinned: false,
      updated_by_id: req.auth.userId,
    })
    .select('id, title, body, workspace_id, group_id, tags, is_pinned, is_public, public_slug, public_published_at, public_expires_at, created_at, updated_at, updated_by_id')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to create note')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: id,
    action: 'note.created',
    metadata: { noteId: noteRow.id, groupId: noteRow.group_id },
  })

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', noteRow.updated_by_id)
    .maybeSingle()
  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load note author')
  }

  res.status(201).json({ data: toNoteResponse(mapNoteRow(noteRow, profileRow)) })
}

export const updateNote = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, group_id, title, body, tags, updated_by_id, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return
  const input = parseBody(updateNoteSchema, req, res)
  if (!input) return

  try {
    await ensureProfile(req.auth)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to sync profile')
  }

  try {
    await saveNoteVersion(supabase, noteRow, req.auth.userId)
  } catch (versionError) {
    return handleSupabaseError(res, versionError, 'Failed to create note version')
  }

  const hasTitle = Object.prototype.hasOwnProperty.call(input, 'title')
  const hasBody = Object.prototype.hasOwnProperty.call(input, 'body')
  const hasTags = Object.prototype.hasOwnProperty.call(input, 'tags')
  const hasPinned = Object.prototype.hasOwnProperty.call(input, 'isPinned')
  const hasGroupId = Object.prototype.hasOwnProperty.call(input, 'groupId')

  const updates = {}
  if (hasTitle) {
    updates.title = sanitizeTitle(input.title)
  }
  if (hasBody) {
    updates.body = sanitizeBody(input.body)
  }
  if (hasTags) {
    const nextTags = input.tags
      .filter((tag) => typeof tag === 'string')
      .map((tag) => sanitizeTag(tag))
      .filter(Boolean)
      .slice(0, 8)
    updates.tags = Array.from(new Set(nextTags))
  }
  if (hasPinned) {
    updates.is_pinned = input.isPinned
  }
  if (hasGroupId) {
    const nextGroupId = sanitizeText(input.groupId)
    if (!nextGroupId) {
      return sendInvalid(res, 'groupId is required')
    }
    try {
      const exists = await ensureGroupExists(supabase, noteRow.workspace_id, nextGroupId)
      if (!exists) {
        return sendInvalid(res, 'groupId is invalid')
      }
    } catch (error) {
      return handleSupabaseError(res, error, 'Failed to validate group')
    }
    updates.group_id = nextGroupId
  }
  updates.updated_at = new Date().toISOString()
  updates.updated_by_id = req.auth.userId

  const { data: updatedRow, error: updateError } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', noteId)
    .select('id, title, body, workspace_id, group_id, tags, is_pinned, is_public, public_slug, public_published_at, public_expires_at, created_at, updated_at, updated_by_id')
    .single()

  if (updateError) {
    return handleSupabaseError(res, updateError, 'Failed to update note')
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', updatedRow.updated_by_id)
    .maybeSingle()
  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load note author')
  }

  res.json({ data: toNoteResponse(mapNoteRow(updatedRow, profileRow)) })
}

export const togglePin = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, is_pinned, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  try {
    await ensureProfile(req.auth)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to sync profile')
  }

  const { data: updatedRow, error } = await supabase
    .from('notes')
    .update({
      is_pinned: !noteRow.is_pinned,
      updated_at: new Date().toISOString(),
      updated_by_id: req.auth.userId,
    })
    .eq('id', noteId)
    .select('id, title, body, workspace_id, group_id, tags, is_pinned, is_public, public_slug, public_published_at, public_expires_at, created_at, updated_at, updated_by_id')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to toggle pin')
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', updatedRow.updated_by_id)
    .maybeSingle()
  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load note author')
  }

  res.json({ data: toNoteResponse(mapNoteRow(updatedRow, profileRow)) })
}

export const deleteNote = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  const { error: deleteError } = await supabase
    .from('notes')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by_id: req.auth.userId,
      is_public: false,
      public_slug: null,
      public_published_at: null,
      public_expires_at: null,
    })
    .eq('id', noteId)

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to delete note')
  }

  res.json({ data: { id: noteId } })
}

export const updateNotePublicStatus = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id

  const input = parseBody(updateNotePublicSchema, req, res)
  if (!input) return

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, deleted_at, is_public, public_slug')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  const memberRow = await requireWorkspaceRole(req, res, noteRow.workspace_id, ['owner', 'admin'])
  if (!memberRow) return

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('plan, is_subscribed')
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
  if (plan !== 'premium_plus') {
    return res.status(403).json({
      error: { code: 'plan_limit', message: 'Upgrade to Premium+ to publish notes.' },
    })
  }

  const nextIsPublic = input.isPublic
  const expiresAt = nextIsPublic
    ? new Date(Date.now() + PUBLIC_NOTE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null
  const updates = {
    is_public: nextIsPublic,
    updated_at: new Date().toISOString(),
    updated_by_id: req.auth.userId,
    public_slug: nextIsPublic ? noteRow.public_slug : null,
    public_published_at: nextIsPublic ? new Date().toISOString() : null,
    public_expires_at: expiresAt,
  }

  if (nextIsPublic && !noteRow.public_slug) {
    let slug = generatePublicSlug()
    let attempts = 0
    while (attempts < 3) {
      updates.public_slug = slug
      const { data, error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', noteId)
        .select('id, title, body, workspace_id, group_id, tags, is_pinned, is_public, public_slug, public_published_at, public_expires_at, created_at, updated_at, updated_by_id')
        .single()

      if (!error) {
        const { data: authorRow, error: authorError } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('id', data.updated_by_id)
          .maybeSingle()

        if (authorError) {
          return handleSupabaseError(res, authorError, 'Failed to load note author')
        }

        await logEvent(supabase, {
          userId: req.auth.userId,
          workspaceId: data.workspace_id,
          action: nextIsPublic ? 'note.published' : 'note.unpublished',
          metadata: { noteId: data.id },
        })

        return res.json({ data: toNoteResponse(mapNoteRow(data, authorRow)) })
      }

      if (error.code !== '23505') {
        return handleSupabaseError(res, error, 'Failed to publish note')
      }

      slug = generatePublicSlug()
      attempts += 1
    }
    return res.status(500).json({ error: { code: 'server_error', message: 'Failed to generate public link' } })
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', noteId)
    .select('id, title, body, workspace_id, group_id, tags, is_pinned, is_public, public_slug, public_published_at, public_expires_at, created_at, updated_at, updated_by_id')
    .single()

  if (updateError) {
    return handleSupabaseError(res, updateError, 'Failed to update public status')
  }

  const { data: authorRow, error: authorError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', updatedRow.updated_by_id)
    .maybeSingle()

  if (authorError) {
    return handleSupabaseError(res, authorError, 'Failed to load note author')
  }

  await logEvent(supabase, {
    userId: req.auth.userId,
    workspaceId: updatedRow.workspace_id,
    action: nextIsPublic ? 'note.published' : 'note.unpublished',
    metadata: { noteId: updatedRow.id },
  })

  res.json({ data: toNoteResponse(mapNoteRow(updatedRow, authorRow)) })
}

export const listNoteVersions = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  const { data: versionRows, error: versionError } = await supabase
    .from('note_versions')
    .select('id, note_id, title, created_at, created_by_id')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (versionError) {
    return handleSupabaseError(res, versionError, 'Failed to load note versions')
  }

  const creatorIds = Array.from(
    new Set((versionRows || []).map((row) => row.created_by_id).filter(Boolean)),
  )

  let profilesMap = new Map()
  try {
    profilesMap = await getProfilesMap(supabase, creatorIds)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load version authors')
  }

  const data = (versionRows || []).map((row) =>
    toNoteVersionResponse(mapVersionRow(row, profilesMap.get(row.created_by_id))),
  )

  res.json({ data })
}

export const getNoteVersion = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id
  const versionId = req.params.versionId

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  const { data: versionRow, error: versionError } = await supabase
    .from('note_versions')
    .select('id, note_id, title, body, tags, created_at, created_by_id')
    .eq('id', versionId)
    .eq('note_id', noteId)
    .maybeSingle()

  if (versionError) {
    return handleSupabaseError(res, versionError, 'Failed to load version')
  }

  if (!versionRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Version not found' } })
  }

  let profile = null
  try {
    if (versionRow.created_by_id) {
      const map = await getProfilesMap(supabase, [versionRow.created_by_id])
      profile = map.get(versionRow.created_by_id)
    }
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load version author')
  }

  res.json({ data: toNoteVersionDetailResponse(mapVersionDetailRow(versionRow, profile)) })
}

export const restoreNoteVersion = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id
  const versionId = req.params.versionId

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, group_id, title, body, tags, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  const { data: versionRow, error: versionError } = await supabase
    .from('note_versions')
    .select('id, note_id, title, body, tags')
    .eq('id', versionId)
    .eq('note_id', noteId)
    .maybeSingle()

  if (versionError) {
    return handleSupabaseError(res, versionError, 'Failed to load note version')
  }

  if (!versionRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Version not found' } })
  }

  try {
    await saveNoteVersion(supabase, noteRow, req.auth.userId)
  } catch (versionSaveError) {
    return handleSupabaseError(res, versionSaveError, 'Failed to save current version')
  }

  const updates = {
    title: versionRow.title || 'Untitled',
    body: versionRow.body || '',
    tags: Array.isArray(versionRow.tags) ? versionRow.tags : [],
    updated_at: new Date().toISOString(),
    updated_by_id: req.auth.userId,
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', noteId)
    .select('id, title, body, workspace_id, group_id, tags, is_pinned, is_public, public_slug, public_published_at, public_expires_at, created_at, updated_at, updated_by_id')
    .single()

  if (updateError) {
    return handleSupabaseError(res, updateError, 'Failed to restore note version')
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', updatedRow.updated_by_id)
    .maybeSingle()
  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load note author')
  }

  res.json({ data: toNoteResponse(mapNoteRow(updatedRow, profileRow)) })
}

export const listNoteAttachments = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  const { data: attachmentRows, error: attachmentError } = await supabase
    .from('note_attachments')
    .select('id, note_id, name, url, size, content_type, created_at, created_by_id')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })

  if (attachmentError) {
    return handleSupabaseError(res, attachmentError, 'Failed to load attachments')
  }

  const creatorIds = Array.from(
    new Set((attachmentRows || []).map((row) => row.created_by_id).filter(Boolean)),
  )

  let profilesMap = new Map()
  try {
    profilesMap = await getProfilesMap(supabase, creatorIds)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load attachment authors')
  }

  const data = (attachmentRows || []).map((row) =>
    toNoteAttachmentResponse(mapAttachmentRow(row, profilesMap.get(row.created_by_id))),
  )

  res.json({ data })
}

export const createNoteAttachment = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id
  const input = parseBody(createNoteAttachmentSchema, req, res)
  if (!input) return

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  const { data: attachmentRow, error } = await supabase
    .from('note_attachments')
    .insert({
      note_id: noteId,
      workspace_id: noteRow.workspace_id,
      name: input.name.trim(),
      url: input.url.trim(),
      size: input.size ?? null,
      content_type: input.contentType ?? null,
      created_by_id: req.auth.userId,
    })
    .select('id, note_id, name, url, size, content_type, created_at, created_by_id')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to add attachment')
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url')
    .eq('id', attachmentRow.created_by_id)
    .maybeSingle()
  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load attachment author')
  }

  res.status(201).json({
    data: toNoteAttachmentResponse(mapAttachmentRow(attachmentRow, profileRow)),
  })
}

export const deleteNoteAttachment = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const noteId = req.params.id
  const attachmentId = req.params.attachmentId

  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id, workspace_id, deleted_at')
    .eq('id', noteId)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }

  if (!noteRow || noteRow.deleted_at) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (!(await requireWorkspaceMember(req, res, noteRow.workspace_id))) return

  const { data: attachmentRow, error: attachmentError } = await supabase
    .from('note_attachments')
    .select('id')
    .eq('id', attachmentId)
    .eq('note_id', noteId)
    .maybeSingle()

  if (attachmentError) {
    return handleSupabaseError(res, attachmentError, 'Failed to load attachment')
  }

  if (!attachmentRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Attachment not found' } })
  }

  const { error: deleteError } = await supabase
    .from('note_attachments')
    .delete()
    .eq('id', attachmentId)

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to delete attachment')
  }

  res.json({ data: { id: attachmentId } })
}

export const getPublicNote = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const slug = sanitizeText(req.params.slug || '')

  if (!slug) {
    return sendInvalid(res, 'slug is required')
  }

  const { data: noteRow, error } = await supabase
    .from('notes')
    .select('id, title, body, updated_at, updated_by_id, public_slug, public_expires_at')
    .eq('public_slug', slug)
    .eq('is_public', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load note')
  }

  if (!noteRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Note not found' } })
  }

  if (noteRow.public_expires_at) {
    const expiresAt = new Date(noteRow.public_expires_at)
    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({ error: { code: 'expired', message: 'This shared link has expired.' } })
    }
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', noteRow.updated_by_id)
    .maybeSingle()

  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load author')
  }

  res.json({ data: toPublicNoteResponse(mapPublicNoteRow(noteRow, profileRow)) })
}
