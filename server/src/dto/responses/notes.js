import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'
import { userResponseSchema } from './auth.js'

const noteResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  bodyPreview: z.string().optional(),
  workspaceId: z.string(),
  groupId: z.string(),
  tags: z.array(z.string()),
  isPinned: z.boolean(),
  isPublic: z.boolean().optional(),
  publicSlug: z.string().nullable().optional(),
  publicPublishedAt: z.string().nullable().optional(),
  publicExpiresAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: userResponseSchema,
})

const publicNoteResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  updatedAt: z.string(),
  updatedBy: z.object({
    id: z.string(),
    name: z.string(),
    avatar: z.string().nullable(),
  }),
  publicSlug: z.string(),
  publicExpiresAt: z.string().nullable().optional(),
})

const noteAttachmentResponseSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  name: z.string(),
  url: z.string(),
  size: z.number().optional(),
  contentType: z.string().optional(),
  createdAt: z.string(),
  createdBy: userResponseSchema,
})

const noteVersionResponseSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  createdBy: userResponseSchema,
})

const noteVersionDetailResponseSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  title: z.string(),
  body: z.string(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  createdBy: userResponseSchema,
})

export const toNoteResponse = (data) => parseOutput(noteResponseSchema, data)
export const toPublicNoteResponse = (data) => parseOutput(publicNoteResponseSchema, data)
export const toNoteAttachmentResponse = (data) => parseOutput(noteAttachmentResponseSchema, data)
export const toNoteVersionResponse = (data) => parseOutput(noteVersionResponseSchema, data)
export const toNoteVersionDetailResponse = (data) => parseOutput(noteVersionDetailResponseSchema, data)
