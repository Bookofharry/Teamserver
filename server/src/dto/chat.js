import { z } from 'zod'

const attachmentSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
})

const mentionSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1).optional(),
  startIndex: z.number().int().nonnegative().optional(),
  endIndex: z.number().int().nonnegative().optional(),
})

export const createChatMessageSchema = z
  .object({
    body: z.string().max(2000).optional(),
    messageType: z.enum(['text', 'image', 'audio']).default('text'),
    attachments: z.array(attachmentSchema).max(6).optional(),
    mentions: z.array(mentionSchema).max(20).optional(),
  })
  .refine((data) => {
    if (data.messageType === 'image') {
      return Array.isArray(data.attachments) && data.attachments.length > 0
    }
    return Boolean(data.body && data.body.trim().length > 0)
  }, {
    message: 'Message body is required for text messages',
  })

export const createChatReactionSchema = z.object({
  emoji: z.string().min(1).max(16),
})

export const createChatUploadSchema = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive().optional(),
})

export const updateChatMessageSchema = z.object({
  body: z.string().max(2000),
  mentions: z.array(mentionSchema).max(20).optional(),
})
