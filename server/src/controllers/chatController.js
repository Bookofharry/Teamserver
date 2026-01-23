import crypto from 'crypto'
import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { parseBody } from '../utils/validation.js'
import { sanitizeBody, sanitizeText } from '../utils/sanitize.js'
import { parsePagination } from '../utils/pagination.js'
import { requireWorkspaceMember, requireWorkspaceRole, mapProfileRow } from './helpers.js'
import {
  createChatMessageSchema,
  createChatReactionSchema,
  createChatUploadSchema,
  updateChatMessageSchema,
} from '../dto/chat.js'
import {
  toChatAttachmentResponse,
  toChatMessageResponse,
  toChatMentionResponse,
  toChatMentionNotificationResponse,
  toChatReactionResponse,
  toChatAuditResponse,
} from '../dto/responses/chat.js'
import { sendMentionEmail } from '../utils/email.js'
import logger from '../utils/logger.js'
import { publishChatRoomEvent } from '../utils/ablyChat.js'

const CHAT_BUCKET = process.env.CHAT_STORAGE_BUCKET || 'workspace-chat'
const CHAT_UPLOAD_TTL_SECONDS = 300
const CHAT_DOWNLOAD_TTL_SECONDS = 3600
const CHAT_EDIT_WINDOW_SECONDS = 120
const MAX_CHAT_UPLOAD_BYTES = Number(process.env.CHAT_UPLOAD_MAX_BYTES) || 5 * 1024 * 1024

const getProfilesMap = async (supabase, userIds) => {
  if (!userIds.length) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, plan, is_subscribed')
    .in('id', userIds)

  if (error) throw error
  return new Map((data || []).map((row) => [row.id, row]))
}

const mapAttachmentRow = (row, profile, signedUrl) =>
  toChatAttachmentResponse({
    id: row.id,
    messageId: row.message_id,
    filePath: row.file_path,
    fileName: row.file_name ?? null,
    contentType: row.content_type ?? null,
    size: row.size ?? null,
    createdAt: row.created_at,
    url: signedUrl ?? null,
    uploadedBy: profile ? mapProfileRow(profile) : undefined,
  })

const mapReactionRow = (row) =>
  toChatReactionResponse({
    id: row.id,
    messageId: row.message_id,
    emoji: row.emoji,
    userId: row.user_id,
    createdAt: row.created_at,
  })

const mapMentionRow = (row) =>
  toChatMentionResponse({
    id: row.id,
    messageId: row.message_id,
    mentionedUserId: row.mentioned_user_id,
    mentionText: row.mention_text ?? null,
    startIndex: row.start_index ?? null,
    endIndex: row.end_index ?? null,
    createdAt: row.created_at,
  })

const mapMessageRow = (row, senderProfile, attachments, reactions, mentions) =>
  toChatMessageResponse({
    id: row.id,
    workspaceId: row.workspace_id,
    body: row.body || '',
    messageType: row.message_type,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null,
    sender: senderProfile ? mapProfileRow(senderProfile) : undefined,
    attachments,
    reactions,
    mentions,
  })

const mapMentionNotification = (row, messageRow, senderProfile) =>
  toChatMentionNotificationResponse({
    id: row.id,
    messageId: row.message_id,
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
    messageCreatedAt: messageRow?.created_at ?? null,
    deletedAt: messageRow?.deleted_at ?? null,
    body: messageRow?.body ?? null,
    sender: senderProfile ? mapProfileRow(senderProfile) : undefined,
  })

const mapAuditRow = (row, actorProfile) =>
  toChatAuditResponse({
    id: row.id,
    workspaceId: row.workspace_id,
    messageId: row.message_id,
    action: row.action,
    createdAt: row.created_at,
    beforeBody: row.before_body ?? null,
    actor: actorProfile ? mapProfileRow(actorProfile) : undefined,
  })

const createSignedAttachmentUrls = async (supabase, attachments) => {
  const urlMap = new Map()
  await Promise.all(
    (attachments || []).map(async (attachment) => {
      const { data, error } = await supabase.storage
        .from(CHAT_BUCKET)
        .createSignedUrl(attachment.file_path, CHAT_DOWNLOAD_TTL_SECONDS)
      if (error) {
        logger.warn({ error: error?.message || error, path: attachment.file_path }, 'Chat attachment signing failed')
        return
      }
      if (data?.signedUrl) {
        urlMap.set(attachment.id, data.signedUrl)
      }
    }),
  )
  return urlMap
}

export const listChatMessages = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const { from, to } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 })

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const { data: messageRows, error } = await supabase
    .from('workspace_messages')
    .select('id, workspace_id, sender_id, body, message_type, created_at, edited_at, deleted_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load chat messages')
  }

  const filteredRows = messageRows.filter(
    (row) => !(row.message_type === 'system' && row.sender_id === req.auth.userId),
  )
  const messageIds = filteredRows.map((row) => row.id)
  const senderIds = Array.from(new Set(filteredRows.map((row) => row.sender_id).filter(Boolean)))

  let profilesMap = new Map()
  try {
    profilesMap = await getProfilesMap(supabase, senderIds)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load chat authors')
  }

  const [attachmentsResult, reactionsResult, mentionsResult] = await Promise.all([
    messageIds.length
      ? supabase
        .from('workspace_message_attachments')
        .select('id, message_id, workspace_id, uploader_id, file_path, file_name, content_type, size, created_at')
        .in('message_id', messageIds)
      : { data: [], error: null },
    messageIds.length
      ? supabase
        .from('workspace_message_reactions')
        .select('id, message_id, workspace_id, user_id, emoji, created_at')
        .in('message_id', messageIds)
      : { data: [], error: null },
    messageIds.length
      ? supabase
        .from('workspace_message_mentions')
        .select('id, message_id, workspace_id, mentioned_user_id, mention_text, start_index, end_index, created_at')
        .in('message_id', messageIds)
      : { data: [], error: null },
  ])

  if (attachmentsResult.error) {
    return handleSupabaseError(res, attachmentsResult.error, 'Failed to load chat attachments')
  }
  if (reactionsResult.error) {
    return handleSupabaseError(res, reactionsResult.error, 'Failed to load chat reactions')
  }
  if (mentionsResult.error) {
    return handleSupabaseError(res, mentionsResult.error, 'Failed to load chat mentions')
  }

  const attachmentProfiles = Array.from(
    new Set((attachmentsResult.data || []).map((row) => row.uploader_id).filter(Boolean)),
  )

  let attachmentProfilesMap = new Map()
  try {
    attachmentProfilesMap = await getProfilesMap(supabase, attachmentProfiles)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load attachment authors')
  }

  const signedUrlMap = await createSignedAttachmentUrls(supabase, attachmentsResult.data || [])
  const attachmentsByMessage = new Map()
  for (const row of attachmentsResult.data || []) {
    const list = attachmentsByMessage.get(row.message_id) || []
    list.push(mapAttachmentRow(row, attachmentProfilesMap.get(row.uploader_id), signedUrlMap.get(row.id)))
    attachmentsByMessage.set(row.message_id, list)
  }

  const reactionsByMessage = new Map()
  for (const row of reactionsResult.data || []) {
    const list = reactionsByMessage.get(row.message_id) || []
    list.push(mapReactionRow(row))
    reactionsByMessage.set(row.message_id, list)
  }

  const mentionsByMessage = new Map()
  for (const row of mentionsResult.data || []) {
    const list = mentionsByMessage.get(row.message_id) || []
    list.push(mapMentionRow(row))
    mentionsByMessage.set(row.message_id, list)
  }

  const data = filteredRows.map((row) => {
    const attachments = row.deleted_at ? [] : attachmentsByMessage.get(row.id) || []
    const reactions = row.deleted_at ? [] : reactionsByMessage.get(row.id) || []
    const mentions = row.deleted_at ? [] : mentionsByMessage.get(row.id) || []
    return mapMessageRow(
      row,
      row.sender_id ? profilesMap.get(row.sender_id) : null,
      attachments,
      reactions,
      mentions,
    )
  })

  res.json({ data })
}

export const createChatMessage = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const input = parseBody(createChatMessageSchema, req, res)
  if (!input) return

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const body = sanitizeBody(input.body || '')
  const messageType = input.messageType
  const attachments = Array.isArray(input.attachments) ? input.attachments : []

  if (messageType === 'text' && !body) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Message body is required' } })
  }

  if ((messageType === 'image' || messageType === 'audio') && attachments.length === 0) {
    return res.status(400).json({ error: { code: 'invalid_request', message: `${messageType} attachment is required` } })
  }

  const sanitizedAttachments = attachments.map((attachment) => ({
    filePath: sanitizeText(attachment.filePath),
    fileName: attachment.fileName ? sanitizeText(attachment.fileName) : null,
    contentType: attachment.contentType ? sanitizeText(attachment.contentType) : null,
    size: Number.isFinite(attachment.size) ? attachment.size : null,
  }))

  const invalidAttachment = sanitizedAttachments.find(
    (attachment) => {
      const type = attachment.contentType || ''
      if (messageType === 'image') return !type.startsWith('image/')
      if (messageType === 'audio') return !type.startsWith('audio/')
      return false
    }
  )
  if (invalidAttachment) {
    return res.status(400).json({ error: { code: 'invalid_request', message: `Invalid attachment type for ${messageType} message` } })
  }

  const { data: messageRow, error } = await supabase
    .from('workspace_messages')
    .insert({
      workspace_id: workspaceId,
      sender_id: req.auth.userId,
      body,
      message_type: messageType,
    })
    .select('id, workspace_id, sender_id, body, message_type, created_at, edited_at, deleted_at')
    .single()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to send message')
  }

  let attachmentRows = []
  if (sanitizedAttachments.length > 0) {
    const { data, error: attachmentError } = await supabase
      .from('workspace_message_attachments')
      .insert(
        sanitizedAttachments.map((attachment) => ({
          message_id: messageRow.id,
          workspace_id: workspaceId,
          uploader_id: req.auth.userId,
          file_path: attachment.filePath,
          file_name: attachment.fileName,
          content_type: attachment.contentType,
          size: attachment.size,
        })),
      )
      .select('id, message_id, workspace_id, uploader_id, file_path, file_name, content_type, size, created_at')

    if (attachmentError) {
      return handleSupabaseError(res, attachmentError, 'Failed to attach message files')
    }
    attachmentRows = data || []
  }

  let mentionRows = []
  let mentionedIds = []
  const mentions = Array.isArray(input.mentions) ? input.mentions : []
  if (mentions.length > 0) {
    mentionedIds = Array.from(
      new Set(mentions.map((mention) => mention.userId).filter(Boolean)),
    )
    const { data: memberRows, error: memberError } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('user_id', mentionedIds)

    if (memberError) {
      return handleSupabaseError(res, memberError, 'Failed to verify mentions')
    }

    const allowedIds = new Set((memberRows || []).map((row) => row.user_id))
    const invalidIds = mentionedIds.filter((id) => !allowedIds.has(id))
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'Invalid mention recipients' } })
    }

    const mentionPayload = mentions.map((mention) => ({
      message_id: messageRow.id,
      workspace_id: workspaceId,
      mentioned_user_id: mention.userId,
      mention_text: mention.text ? sanitizeText(mention.text) : null,
      start_index: Number.isFinite(mention.startIndex) ? mention.startIndex : null,
      end_index: Number.isFinite(mention.endIndex) ? mention.endIndex : null,
    }))

    const { data, error: mentionError } = await supabase
      .from('workspace_message_mentions')
      .insert(mentionPayload)
      .select('id, message_id, mentioned_user_id, mention_text, start_index, end_index, created_at')

    if (mentionError) {
      return handleSupabaseError(res, mentionError, 'Failed to add mentions')
    }
    mentionRows = data || []
    const notificationPayload = mentionPayload.map((mention) => ({
      workspace_id: workspaceId,
      message_id: messageRow.id,
      user_id: mention.mentioned_user_id,
      type: 'mention',
    }))
    const { error: notificationError } = await supabase
      .from('workspace_message_notifications')
      .insert(notificationPayload)

    if (notificationError && notificationError.code !== '23505') {
      logger.warn(
        { error: notificationError?.message || notificationError },
        'Failed to create mention notifications',
      )
    }
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, plan, is_subscribed')
    .eq('id', messageRow.sender_id)
    .maybeSingle()

  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load sender')
  }

  if (mentionedIds.length > 0) {
    const { data: mentionedProfiles, error: mentionedError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', mentionedIds)

    if (mentionedError) {
      logger.warn({ error: mentionedError?.message || mentionedError }, 'Failed to load mention recipients')
    } else {
      const { data: workspaceRow, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('id', workspaceId)
        .maybeSingle()

      if (workspaceError) {
        logger.warn({ error: workspaceError?.message || workspaceError }, 'Failed to load workspace for mentions')
      } else {
        const senderName = profileRow?.full_name || profileRow?.email || 'Someone'
        const workspaceName = workspaceRow?.name || 'TeamPad workspace'
        const snippet = body.slice(0, 220)

        await Promise.all(
          (mentionedProfiles || [])
            .filter((profile) => profile.email && profile.id !== req.auth.userId)
            .map((profile) =>
              sendMentionEmail({
                to: profile.email,
                workspaceName,
                senderName,
                snippet,
              }).catch((error) => {
                logger.warn({ error: error?.message || error, email: profile.email }, 'Failed to send mention email')
              }),
            ),
        )
      }
    }
  }

  const signedUrlMap = await createSignedAttachmentUrls(supabase, attachmentRows)
  const attachmentData = attachmentRows.map((row) =>
    mapAttachmentRow(row, row.uploader_id ? profileRow : null, signedUrlMap.get(row.id)),
  )
  const reactions = []
  const mentionsList = mentionRows.map((row) => mapMentionRow(row))

  const data = mapMessageRow(messageRow, profileRow, attachmentData, reactions, mentionsList)

  res.status(201).json({ data })

  publishChatRoomEvent(`workspace:${workspaceId}`, { type: 'message.created', message: data })
    .catch(() => { })
}

export const getChatUnreadCounts = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const sinceRaw = String(req.query?.since || '')
  const sinceDate = sinceRaw ? new Date(sinceRaw) : new Date(0)
  const sinceIso = Number.isNaN(sinceDate.getTime()) ? new Date(0).toISOString() : sinceDate.toISOString()

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const { count: unreadCount, error: unreadError } = await supabase
    .from('workspace_messages')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .gt('created_at', sinceIso)
    .neq('sender_id', req.auth.userId)

  if (unreadError) {
    return handleSupabaseError(res, unreadError, 'Failed to load unread count')
  }

  const { count: mentionCount, error: mentionError } = await supabase
    .from('workspace_message_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.auth.userId)
    .is('read_at', null)

  if (mentionError) {
    return handleSupabaseError(res, mentionError, 'Failed to load mention count')
  }

  res.json({
    data: {
      unreadCount: unreadCount ?? 0,
      mentionCount: mentionCount ?? 0,
      since: sinceIso,
    },
  })
}

export const listChatMentions = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const status = String(req.query?.status || 'unread').toLowerCase()

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  if (!['unread', 'all'].includes(status)) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Invalid mention status' } })
  }

  let query = supabase
    .from('workspace_message_notifications')
    .select('id, message_id, user_id, created_at, read_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.auth.userId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (status === 'unread') {
    query = query.is('read_at', null)
  }

  const { data: notificationRows, error: notificationError } = await query

  if (notificationError) {
    return handleSupabaseError(res, notificationError, 'Failed to load mention notifications')
  }

  if (!notificationRows?.length) {
    return res.json({ data: [] })
  }

  const messageIds = Array.from(new Set(notificationRows.map((row) => row.message_id)))
  const { data: messageRows, error: messageError } = await supabase
    .from('workspace_messages')
    .select('id, sender_id, body, created_at, deleted_at')
    .in('id', messageIds)

  if (messageError) {
    return handleSupabaseError(res, messageError, 'Failed to load mention messages')
  }

  const messageMap = new Map((messageRows || []).map((row) => [row.id, row]))
  const senderIds = Array.from(
    new Set((messageRows || []).map((row) => row.sender_id).filter(Boolean)),
  )

  let profilesMap = new Map()
  try {
    profilesMap = await getProfilesMap(supabase, senderIds)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load mention senders')
  }

  const data = notificationRows.map((row) => {
    const messageRow = messageMap.get(row.message_id)
    const senderProfile = messageRow?.sender_id ? profilesMap.get(messageRow.sender_id) : null
    return mapMentionNotification(row, messageRow, senderProfile)
  })

  res.json({ data })
}

export const listChatAudits = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id

  if (!(await requireWorkspaceRole(req, res, workspaceId, ['owner', 'admin']))) return

  const { data: auditRows, error: auditError } = await supabase
    .from('workspace_message_audits')
    .select('id, workspace_id, message_id, actor_id, action, before_body, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (auditError) {
    return handleSupabaseError(res, auditError, 'Failed to load chat audits')
  }

  const actorIds = Array.from(new Set((auditRows || []).map((row) => row.actor_id).filter(Boolean)))
  let profilesMap = new Map()
  try {
    profilesMap = await getProfilesMap(supabase, actorIds)
  } catch (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load audit actors')
  }

  const data = (auditRows || []).map((row) => mapAuditRow(row, profilesMap.get(row.actor_id)))
  res.json({ data })
}

export const createChatReaction = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const messageId = req.params.messageId
  const input = parseBody(createChatReactionSchema, req, res)
  if (!input) return

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const { data: messageRow, error: messageError } = await supabase
    .from('workspace_messages')
    .select('id, workspace_id, sender_id, deleted_at')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) {
    return handleSupabaseError(res, messageError, 'Failed to load message')
  }

  if (!messageRow || messageRow.deleted_at || messageRow.workspace_id !== workspaceId) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Message not found' } })
  }
  if (messageRow.sender_id === req.auth.userId) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Cannot react to your own message' } })
  }

  const { data: reactionRow, error } = await supabase
    .from('workspace_message_reactions')
    .insert({
      message_id: messageId,
      workspace_id: workspaceId,
      user_id: req.auth.userId,
      emoji: input.emoji,
    })
    .select('id, message_id, user_id, emoji, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      const { data: existingRow, error: existingError } = await supabase
        .from('workspace_message_reactions')
        .select('id, message_id, user_id, emoji, created_at')
        .eq('message_id', messageId)
        .eq('user_id', req.auth.userId)
        .eq('emoji', input.emoji)
        .maybeSingle()
      if (existingError) {
        return handleSupabaseError(res, existingError, 'Failed to load reaction')
      }
      if (existingRow) {
        const data = mapReactionRow(existingRow)
        return res.json({ data })
      }
      return res.status(409).json({ error: { code: 'already_exists', message: 'Reaction already added' } })
    }
    return handleSupabaseError(res, error, 'Failed to add reaction')
  }

  const data = mapReactionRow(reactionRow)
  res.status(201).json({ data })

  publishChatRoomEvent(`workspace:${workspaceId}`, { type: 'reaction.created', reaction: data })
    .catch(() => { })
}

export const deleteChatReaction = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const messageId = req.params.messageId
  const emoji = sanitizeText(decodeURIComponent(req.params.emoji || ''))

  if (!emoji) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Emoji is required' } })
  }

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const { data: reactionRow, error } = await supabase
    .from('workspace_message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.auth.userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (error) {
    return handleSupabaseError(res, error, 'Failed to load reaction')
  }

  if (!reactionRow) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Reaction not found' } })
  }

  const { error: deleteError } = await supabase
    .from('workspace_message_reactions')
    .delete()
    .eq('id', reactionRow.id)

  if (deleteError) {
    return handleSupabaseError(res, deleteError, 'Failed to delete reaction')
  }

  const response = { id: reactionRow.id, messageId }
  res.json({ data: response })

  publishChatRoomEvent(`workspace:${workspaceId}`, { type: 'reaction.deleted', reaction: response })
    .catch(() => { })
}

export const createChatUpload = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const input = parseBody(createChatUploadSchema, req, res)
  if (!input) return

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  if (!input.contentType.startsWith('image/') && !input.contentType.startsWith('audio/')) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Only images and audio files are allowed' } })
  }
  if (input.size && input.size > MAX_CHAT_UPLOAD_BYTES) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Image exceeds upload size limit' } })
  }

  const safeName = sanitizeText(input.fileName).replace(/\s+/g, '-')
  const uniqueName = `${crypto.randomUUID()}-${safeName || 'upload'}`
  const path = `workspaces/${workspaceId}/chat/${uniqueName}`

  const { data, error } = await supabase.storage
    .from(CHAT_BUCKET)
    .createSignedUploadUrl(path, CHAT_UPLOAD_TTL_SECONDS)

  if (error) {
    return handleSupabaseError(res, error, 'Failed to create upload URL')
  }

  res.json({
    data: {
      bucket: CHAT_BUCKET,
      path: data.path,
      uploadUrl: data.signedUrl,
      expiresIn: CHAT_UPLOAD_TTL_SECONDS,
    },
  })
}

export const updateChatMessage = async (req, res) => {
  return res.status(403).json({
    error: { code: 'forbidden', message: 'Message editing is currently disabled' },
  })

  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const messageId = req.params.messageId
  const input = parseBody(updateChatMessageSchema, req, res)
  if (!input) return

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const { data: messageRow, error: messageError } = await supabase
    .from('workspace_messages')
    .select('id, workspace_id, sender_id, body, message_type, created_at, deleted_at')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) {
    return handleSupabaseError(res, messageError, 'Failed to load message')
  }

  if (!messageRow || messageRow.deleted_at || messageRow.workspace_id !== workspaceId) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Message not found' } })
  }

  if (messageRow.sender_id !== req.auth.userId) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Only the sender can edit messages' } })
  }

  if (messageRow.message_type !== 'text') {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Only text messages can be edited' } })
  }

  const createdAt = new Date(messageRow.created_at)
  const ageSeconds = (Date.now() - createdAt.getTime()) / 1000
  if (ageSeconds > CHAT_EDIT_WINDOW_SECONDS) {
    return res.status(403).json({ error: { code: 'forbidden', message: 'Edit window expired' } })
  }

  const body = sanitizeBody(input.body || '')
  if (!body) {
    return res.status(400).json({ error: { code: 'invalid_request', message: 'Message body is required' } })
  }

  const { data: updatedRow, error: updateError } = await supabase
    .from('workspace_messages')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .select('id, workspace_id, sender_id, body, message_type, created_at, edited_at, deleted_at')
    .single()

  if (updateError) {
    return handleSupabaseError(res, updateError, 'Failed to update message')
  }

  const { error: auditError } = await supabase.from('workspace_message_audits').insert({
    workspace_id: workspaceId,
    message_id: messageId,
    actor_id: req.auth.userId,
    action: 'edited',
    before_body: messageRow.body,
    after_body: body,
  })

  if (auditError) {
    logger.warn({ error: auditError?.message || auditError }, 'Chat audit insert failed')
  }

  let mentionRows = []
  const mentions = Array.isArray(input.mentions) ? input.mentions : []
  if (mentions.length > 0) {
    const mentionedIds = Array.from(
      new Set(mentions.map((mention) => mention.userId).filter(Boolean)),
    )
    const { data: memberRows, error: memberError } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .in('user_id', mentionedIds)

    if (memberError) {
      return handleSupabaseError(res, memberError, 'Failed to verify mentions')
    }

    const allowedIds = new Set((memberRows || []).map((row) => row.user_id))
    const invalidIds = mentionedIds.filter((id) => !allowedIds.has(id))
    if (invalidIds.length > 0) {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'Invalid mention recipients' } })
    }

    const { data: existingMentions, error: existingError } = await supabase
      .from('workspace_message_mentions')
      .select('mentioned_user_id')
      .eq('message_id', messageId)

    if (existingError) {
      return handleSupabaseError(res, existingError, 'Failed to load mentions')
    }

    const existingIds = new Set((existingMentions || []).map((row) => row.mentioned_user_id))

    const { error: deleteError } = await supabase
      .from('workspace_message_mentions')
      .delete()
      .eq('message_id', messageId)

    if (deleteError) {
      return handleSupabaseError(res, deleteError, 'Failed to reset mentions')
    }

    const mentionPayload = mentions.map((mention) => ({
      message_id: messageId,
      workspace_id: workspaceId,
      mentioned_user_id: mention.userId,
      mention_text: mention.text ? sanitizeText(mention.text) : null,
      start_index: Number.isFinite(mention.startIndex) ? mention.startIndex : null,
      end_index: Number.isFinite(mention.endIndex) ? mention.endIndex : null,
    }))

    const { data: mentionData, error: mentionError } = await supabase
      .from('workspace_message_mentions')
      .insert(mentionPayload)
      .select('id, message_id, mentioned_user_id, mention_text, start_index, end_index, created_at')

    if (mentionError) {
      return handleSupabaseError(res, mentionError, 'Failed to update mentions')
    }

    mentionRows = mentionData || []

    const newMentionIds = mentionedIds.filter((id) => !existingIds.has(id))
    if (newMentionIds.length > 0) {
      const notificationPayload = newMentionIds.map((userId) => ({
        workspace_id: workspaceId,
        message_id: messageId,
        user_id: userId,
        type: 'mention',
      }))
      const { error: notificationError } = await supabase
        .from('workspace_message_notifications')
        .insert(notificationPayload)
      if (notificationError && notificationError.code !== '23505') {
        logger.warn(
          { error: notificationError?.message || notificationError },
          'Failed to add mention notifications',
        )
      }
    }
  } else {
    const { error: deleteError } = await supabase
      .from('workspace_message_mentions')
      .delete()
      .eq('message_id', messageId)
    if (deleteError) {
      return handleSupabaseError(res, deleteError, 'Failed to clear mentions')
    }
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, plan, is_subscribed')
    .eq('id', updatedRow.sender_id)
    .maybeSingle()

  if (profileError) {
    return handleSupabaseError(res, profileError, 'Failed to load sender')
  }

  const data = mapMessageRow(updatedRow, profileRow, [], [], mentionRows.map(mapMentionRow))

  res.json({ data })
}

export const deleteChatMessage = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id
  const messageId = req.params.messageId

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const { data: messageRow, error: messageError } = await supabase
    .from('workspace_messages')
    .select('id, workspace_id, sender_id, body, deleted_at')
    .eq('id', messageId)
    .maybeSingle()

  if (messageError) {
    return handleSupabaseError(res, messageError, 'Failed to load message')
  }

  if (!messageRow || messageRow.deleted_at || messageRow.workspace_id !== workspaceId) {
    return res.status(404).json({ error: { code: 'not_found', message: 'Message not found' } })
  }

  if (messageRow.sender_id !== req.auth.userId) {
    const roleCheck = await requireWorkspaceRole(req, res, workspaceId, ['owner', 'admin'])
    if (!roleCheck) return
  }

  const deletedAt = new Date().toISOString()
  const { data: updatedRow, error: updateError } = await supabase
    .from('workspace_messages')
    .update({ body: '', deleted_at: deletedAt })
    .eq('id', messageId)
    .select('id, workspace_id, sender_id, body, message_type, created_at, edited_at, deleted_at')
    .single()

  if (updateError) {
    return handleSupabaseError(res, updateError, 'Failed to delete message')
  }

  const { error: auditError } = await supabase.from('workspace_message_audits').insert({
    workspace_id: workspaceId,
    message_id: messageId,
    actor_id: req.auth.userId,
    action: 'deleted',
    before_body: messageRow.body,
  })

  if (auditError) {
    logger.warn({ error: auditError?.message || auditError }, 'Chat audit insert failed')
  }

  const { error: notificationError } = await supabase
    .from('workspace_message_notifications')
    .update({ read_at: deletedAt })
    .eq('message_id', messageId)
    .is('read_at', null)

  if (notificationError) {
    logger.warn({ error: notificationError?.message || notificationError }, 'Chat notification cleanup failed')
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id, full_name, email, avatar_url, plan, is_subscribed')
    .eq('id', updatedRow.sender_id)
    .maybeSingle()

  const data = mapMessageRow(updatedRow, profileRow, [], [], [])

  res.json({ data })

  publishChatRoomEvent(`workspace:${workspaceId}`, { type: 'message.deleted', message: data })
    .catch(() => { })
}

export const markChatMentionsRead = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const workspaceId = req.params.id

  if (!(await requireWorkspaceMember(req, res, workspaceId))) return

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('workspace_message_notifications')
    .update({ read_at: now })
    .eq('workspace_id', workspaceId)
    .eq('user_id', req.auth.userId)
    .is('read_at', null)
    .select('id')

  if (error) {
    return handleSupabaseError(res, error, 'Failed to mark mentions read')
  }

  res.json({ data: { updated: data?.length ?? 0 } })
}
