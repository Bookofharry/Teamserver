import { z } from 'zod'

export const createWorkspaceSchema = z.object({
  name: z.string().trim().optional(),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
})

export const createInviteSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  role: z.string().trim().optional(),
})
