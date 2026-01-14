import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'

const planSchema = z.enum(['free', 'premium', 'premium_plus']).catch('free')

export const userResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatar: z.string().nullable(),
  twoFactorEnabled: z.boolean(),
  isSubscribed: z.boolean(),
  plan: planSchema,
  lastWorkspaceId: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  statusEmoji: z.string().nullable().optional(),
  hasSeenOnboarding: z.boolean().default(false),
})

export const sessionResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
})

export const checkEmailResponseSchema = z.object({
  exists: z.boolean(),
})

export const clearSessionResponseSchema = z.object({
  cleared: z.boolean(),
})

export const toUserResponse = (data) => parseOutput(userResponseSchema, data)
export const toSessionResponse = (data) => parseOutput(sessionResponseSchema, data)
export const toCheckEmailResponse = (data) => parseOutput(checkEmailResponseSchema, data)
export const toClearSessionResponse = (data) => parseOutput(clearSessionResponseSchema, data)
