import { z } from 'zod'

export const createNoteSchema = z.object({
  groupId: z.string().trim().min(1, 'groupId is required'),
  title: z.string().trim().optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const updateNoteSchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isPinned: z.boolean().optional(),
    groupId: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'No fields to update',
  })

export const updateNotePublicSchema = z.object({
  isPublic: z.boolean(),
})

export const createNoteAttachmentSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  url: z.string().trim().url('Valid url is required'),
  size: z.number().int().nonnegative().optional(),
  contentType: z.string().trim().optional(),
})
