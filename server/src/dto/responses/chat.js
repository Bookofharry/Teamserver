import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'
import { userResponseSchema } from './auth.js'

const chatAttachmentResponseSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  filePath: z.string(),
  fileName: z.string().nullable(),
  contentType: z.string().nullable(),
  size: z.number().nullable(),
  createdAt: z.string(),
  url: z.string().nullable().optional(),
  uploadedBy: userResponseSchema.optional(),
})

const chatReactionResponseSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  emoji: z.string(),
  userId: z.string(),
  createdAt: z.string(),
})

const chatMentionResponseSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  mentionedUserId: z.string(),
  mentionText: z.string().nullable(),
  startIndex: z.number().nullable(),
  endIndex: z.number().nullable(),
  createdAt: z.string(),
})

const chatMessageResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  body: z.string(),
  messageType: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  sender: userResponseSchema.optional(),
  attachments: z.array(chatAttachmentResponseSchema),
  reactions: z.array(chatReactionResponseSchema),
  mentions: z.array(chatMentionResponseSchema),
})

const chatMentionNotificationSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
  messageCreatedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  body: z.string().nullable(),
  sender: userResponseSchema.optional(),
})

const chatAuditResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  messageId: z.string(),
  action: z.string(),
  createdAt: z.string(),
  beforeBody: z.string().nullable(),
  actor: userResponseSchema.optional(),
})

export const toChatAttachmentResponse = (data) => parseOutput(chatAttachmentResponseSchema, data)
export const toChatReactionResponse = (data) => parseOutput(chatReactionResponseSchema, data)
export const toChatMentionResponse = (data) => parseOutput(chatMentionResponseSchema, data)
export const toChatMessageResponse = (data) => parseOutput(chatMessageResponseSchema, data)
export const toChatMentionNotificationResponse = (data) => parseOutput(chatMentionNotificationSchema, data)
export const toChatAuditResponse = (data) => parseOutput(chatAuditResponseSchema, data)
