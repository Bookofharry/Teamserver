import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'

const aiIngestResponseSchema = z.object({
  ok: z.boolean(),
  count: z.number(),
})

const aiAskResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.any()).optional(),
})

const aiDebugResponseSchema = z.object({
  auth: z.object({
    userId: z.string(),
    email: z.string().nullable(),
  }),
  plan: z.object({
    resolvedPlan: z.string(),
    profilePlan: z.string().nullable(),
    authPlan: z.string().nullable(),
    isSubscribed: z.boolean(),
    allowed: z.boolean(),
  }),
  membership: z
    .object({
      workspaceId: z.string(),
      isMember: z.boolean().nullable(),
    })
    .nullable()
    .optional(),
  provider: z.object({
    name: z.string(),
    gemini: z.object({
      apiUrlSet: z.boolean(),
      apiKeySet: z.boolean(),
      chatModel: z.string(),
      embeddingModel: z.string(),
    }),
  }),
  ping: z.object({
    ok: z.boolean(),
    provider: z.string(),
    error: z.string().nullable().optional(),
    sample: z.string().optional(),
  }),
})

const aiStreamErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
})

export const toAiIngestResponse = (data) => parseOutput(aiIngestResponseSchema, data)
export const toAiAskResponse = (data) => parseOutput(aiAskResponseSchema, data)
export const toAiDebugResponse = (data) => parseOutput(aiDebugResponseSchema, data)
export const toAiStreamErrorResponse = (data) => parseOutput(aiStreamErrorSchema, data)
