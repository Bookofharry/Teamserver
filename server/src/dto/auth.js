import { z } from 'zod'

export const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8),
})

export const signupRequestSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
})

export const signupVerifySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8),
  code: z.string().trim().min(6).max(6),
})

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1),
  password: z.string().min(8),
})

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    avatar: z.string().trim().optional(),
    lastWorkspaceId: z.string().trim().uuid().optional(),
    status: z.string().trim().optional().nullable(),
    statusEmoji: z.string().trim().optional().nullable(),
    hasSeenOnboarding: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.avatar !== undefined ||
      data.lastWorkspaceId !== undefined ||
      data.status !== undefined ||
      data.statusEmoji !== undefined ||
      data.hasSeenOnboarding !== undefined,
    {
      message: 'No fields to update',
    }
  )

export const checkEmailSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
})
