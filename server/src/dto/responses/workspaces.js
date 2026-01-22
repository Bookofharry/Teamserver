import { z } from 'zod'
import { parseOutput } from '../../utils/validation.js'
import { userResponseSchema } from './auth.js'

const workspaceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string().optional(),
  createdAt: z.string(),
  memberCount: z.number().optional(),
})

const workspaceMemberResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string(),
  role: z.string(),
  joinedAt: z.string(),
  user: userResponseSchema,
})

const inviteResponseSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  email: z.string(),
  role: z.string(),
  token: z.string(),
  expiresAt: z.string(),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
})

const inviteDetailsResponseSchema = inviteResponseSchema.extend({
  workspaceName: z.string(),
  inviter: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      avatar: z.string().nullable(),
    })
    .optional(),
})

const acceptInviteResponseSchema = z.object({
  workspaceId: z.string(),
  member: z.object({
    id: z.string(),
    userId: z.string(),
    role: z.string(),
  }),
})

const removeMemberResponseSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
})

const inviteDeclineResponseSchema = z.object({
  workspaceId: z.string(),
  email: z.string(),
})

const deleteWorkspaceResponseSchema = z.object({
  id: z.string(),
})

export const toWorkspaceResponse = (data) => parseOutput(workspaceResponseSchema, data)
export const toWorkspaceMemberResponse = (data) => parseOutput(workspaceMemberResponseSchema, data)
export const toInviteResponse = (data) => parseOutput(inviteResponseSchema, data)
export const toInviteDetailsResponse = (data) => parseOutput(inviteDetailsResponseSchema, data)
export const toAcceptInviteResponse = (data) => parseOutput(acceptInviteResponseSchema, data)
export const toRemoveMemberResponse = (data) => parseOutput(removeMemberResponseSchema, data)
export const toInviteDeclineResponse = (data) => parseOutput(inviteDeclineResponseSchema, data)
export const toDeleteWorkspaceResponse = (data) => parseOutput(deleteWorkspaceResponseSchema, data)
