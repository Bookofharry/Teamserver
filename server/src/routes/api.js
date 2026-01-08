import express from 'express'
import rateLimit from 'express-rate-limit'
import { requireSupabaseAuth } from '../auth/supabaseAuth.js'
import { checkEmail, clearSession, createSession, getMe, updateMe } from '../controllers/authController.js'
import { createUpgradeIntent } from '../controllers/billingController.js'
import { createIdempotencyMiddleware } from '../middleware/idempotency.js'
import { requireAdmin } from '../middleware/admin.js'
import { ensureCsrfCookie } from '../middleware/csrf.js'
import { listAdminUsers, updateAdminUserPlan } from '../controllers/adminController.js'
import {
  acceptInvite,
  createInvite,
  createWorkspace,
  deleteWorkspace,
  declineInvite,
  getInviteInfo,
  listMyInvites,
  listWorkspaceMembers,
  listWorkspaceInvites,
  listWorkspaces,
  removeWorkspaceMember,
  updateWorkspace,
} from '../controllers/workspacesController.js'
import { createGroup, deleteGroup, listGroups } from '../controllers/groupsController.js'
import {
  createNote,
  createNoteAttachment,
  deleteNote,
  deleteNoteAttachment,
  getNoteVersion,
  getPublicNote,
  listNoteAttachments,
  listNoteVersions,
  listNotes,
  restoreNoteVersion,
  togglePin,
  updateNote,
  updateNotePublicStatus,
} from '../controllers/notesController.js'

const router = express.Router()

const makeLimiter = ({ windowMs = 60 * 1000, max = 60, keyGenerator, message } = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: keyGenerator || ((req) => req.auth?.userId || req.ip),
    message: message || { error: { code: 'rate_limited', message: 'Too many requests. Please slow down.' } },
  })

const publicLimiter = makeLimiter({ windowMs: 60 * 1000, max: 30, keyGenerator: (req) => req.ip })
const writeLimiter = makeLimiter({ windowMs: 60 * 1000, max: 20 })

// Read limiters with different caps for per-route tuning
const readLimiterHigh = makeLimiter({ windowMs: 60 * 1000, max: 120 })
const readLimiterDefault = makeLimiter({ windowMs: 60 * 1000, max: 60 })
const readLimiterLow = makeLimiter({ windowMs: 60 * 1000, max: 30 })


const idempotencyWorkspace = createIdempotencyMiddleware('create_workspace')
const idempotencyGroup = createIdempotencyMiddleware('create_group')
const idempotencyNote = createIdempotencyMiddleware('create_note')
const idempotencyInvite = createIdempotencyMiddleware('create_invite')

router.post('/auth/check-email', publicLimiter, checkEmail)
router.post('/auth/session', publicLimiter, createSession)
router.post('/auth/logout', publicLimiter, clearSession)
router.get('/csrf', publicLimiter, (req, res) => {
  const token = ensureCsrfCookie(req, res)
  res.json({ data: { token } })
})
router.get('/invites/:token', publicLimiter, getInviteInfo)
router.get('/public/notes/:slug', publicLimiter, getPublicNote)

router.use(requireSupabaseAuth)

router.get('/me', readLimiterHigh, getMe)
router.patch('/me', writeLimiter, updateMe)
router.post('/upgrade-intents', writeLimiter, createUpgradeIntent)
router.get('/invites', readLimiterDefault, listMyInvites)

router.get('/admin/users', readLimiterDefault, requireAdmin, listAdminUsers)
router.patch('/admin/users/:id/plan', writeLimiter, requireAdmin, updateAdminUserPlan)

router.get('/workspaces', readLimiterLow, listWorkspaces)
router.post('/workspaces', writeLimiter, idempotencyWorkspace, createWorkspace)
router.patch('/workspaces/:id', writeLimiter, updateWorkspace)
router.delete('/workspaces/:id', writeLimiter, deleteWorkspace)
router.get('/workspaces/:id/members', readLimiterDefault, listWorkspaceMembers)
router.get('/workspaces/:id/invites', readLimiterDefault, listWorkspaceInvites)
router.delete('/workspaces/:id/members/:userId', writeLimiter, removeWorkspaceMember)
router.post('/workspaces/:id/invites', writeLimiter, idempotencyInvite, createInvite)
router.post('/invites/:token/accept', writeLimiter, acceptInvite)
router.post('/invites/:token/decline', writeLimiter, declineInvite)
router.get('/workspaces/:id/groups', readLimiterDefault, listGroups)
router.post('/workspaces/:id/groups', writeLimiter, idempotencyGroup, createGroup)
router.delete('/workspaces/:id/groups/:groupId', writeLimiter, deleteGroup)
router.get('/workspaces/:id/notes', readLimiterLow, listNotes)
router.post('/workspaces/:id/notes', writeLimiter, idempotencyNote, createNote)
router.patch('/notes/:id', writeLimiter, updateNote)
router.post('/notes/:id/toggle-pin', writeLimiter, togglePin)
router.patch('/notes/:id/public', writeLimiter, updateNotePublicStatus)
router.delete('/notes/:id', writeLimiter, deleteNote)
router.get('/notes/:id/versions', readLimiterDefault, listNoteVersions)
router.get('/notes/:id/versions/:versionId', readLimiterDefault, getNoteVersion)
router.post('/notes/:id/versions/:versionId/restore', writeLimiter, restoreNoteVersion)
router.get('/notes/:id/attachments', readLimiterDefault, listNoteAttachments)
router.post('/notes/:id/attachments', writeLimiter, createNoteAttachment)
router.delete('/notes/:id/attachments/:attachmentId', writeLimiter, deleteNoteAttachment)

// AI endpoints (scaffold)
import { ingestNote, askWorkspace, streamWorkspace, debugAi } from '../controllers/aiController.js'

router.post('/ai/ingest', writeLimiter, ingestNote)
router.post('/ai/ask', readLimiterDefault, askWorkspace)
router.post('/ai/stream', readLimiterDefault, streamWorkspace)
router.post('/ai/debug', readLimiterDefault, debugAi)

export { router as apiRouter }
