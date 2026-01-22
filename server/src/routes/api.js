import express from 'express'
import rateLimit from 'express-rate-limit'
import { requireSupabaseAuth } from '../auth/supabaseAuth.js'
import {
  checkEmail,
  clearSession,
  forgotPassword,
  getMe,
  login,
  refreshSession,
  requestTwoFactorEnroll,
  verifyTwoFactorEnroll,
  disableTwoFactor,
  verifyTwoFactorLogin,
  resendTwoFactorLogin,
  signOutEverywhere,
  resetPassword,
  requestSignupOtp,
  verifySignupOtp,
  updateMe,
} from '../controllers/authController.js'
import { createUpgradeIntent } from '../controllers/billingController.js'
import { getWorkspaceAnalytics, listWorkspaceAuditLogs } from '../controllers/analyticsController.js'
import { createIdempotencyMiddleware } from '../middleware/idempotency.js'
import { requireAdmin } from '../middleware/admin.js'
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
  leaveWorkspace,
  updateWorkspace,
} from '../controllers/workspacesController.js'
import { createGroup, deleteGroup, listGroups } from '../controllers/groupsController.js'
import {
  createNote,
  createNoteAttachment,
  deleteNote,
  deleteNotePermanently,
  deleteNoteAttachment,
  listTrashNotes,
  getNoteVersion,
  getPublicNote,
  listNoteAttachments,
  listNoteVersions,
  listNotes,
  getNote,
  restoreNote,
  restoreNoteVersion,
  togglePin,
  updateNote,
  updateNotePublicStatus,
} from '../controllers/notesController.js'
import {
  createChatMessage,
  createChatReaction,
  createChatUpload,
  deleteChatMessage,
  deleteChatReaction,
  getChatUnreadCounts,
  listChatAudits,
  listChatMentions,
  listChatMessages,
  markChatMentionsRead,
  updateChatMessage,
} from '../controllers/chatController.js'
import { createAblyToken } from '../controllers/ablyController.js'
import { publishChatEvent } from '../controllers/ablyChatController.js'
import logger from '../utils/logger.js'

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

const publicLimiter = makeLimiter({ windowMs: 60 * 1000, max: 120, keyGenerator: (req) => req.ip })
const authLimiter = makeLimiter({ windowMs: 60 * 1000, max: 300, keyGenerator: (req) => req.ip })
const writeLimiter = makeLimiter({ windowMs: 60 * 1000, max: 20 })

// Read limiters with different caps for per-route tuning
const readLimiterHigh = makeLimiter({ windowMs: 60 * 1000, max: 120 })
const readLimiterDefault = makeLimiter({ windowMs: 60 * 1000, max: 60 })
const readLimiterLow = makeLimiter({ windowMs: 60 * 1000, max: 30 })
const readLimiterChatMarks = makeLimiter({ windowMs: 60 * 1000, max: 300 })
const idempotencyWorkspace = createIdempotencyMiddleware('create_workspace')
const idempotencyGroup = createIdempotencyMiddleware('create_group')
const idempotencyNote = createIdempotencyMiddleware('create_note')
const idempotencyInvite = createIdempotencyMiddleware('create_invite')

router.post('/auth/check-email', checkEmail)
router.post('/auth/signup/request', requestSignupOtp)
router.post('/auth/signup/verify', verifySignupOtp)

// Helper for logging rate limit headers
const logRateLimit = (req, name) => {
  if (process.env.NODE_ENV !== 'production') {
    logger.info({
      ip: req.ip,
      path: req.path,
      remaining: req.rateLimit?.remaining,
    }, `[DEBUG] RateLimit: ${name}`);
  }
}

router.use('/auth/login', (req, res, next) => {
  console.log(`[DEBUG] /auth/login PRE-HANDLER. Method: ${req.method}, Content-Type: ${req.headers['content-type']}`);
  logRateLimit(req, 'Pre-Login');
  next();
});


router.post('/auth/login', authLimiter, login)
router.post('/auth/logout', authLimiter, clearSession)
router.post('/auth/2fa/verify', authLimiter, verifyTwoFactorLogin)
router.post('/auth/2fa/resend', authLimiter, resendTwoFactorLogin)
router.post('/auth/forgot-password', forgotPassword)
router.post('/auth/reset-password', resetPassword)
router.get('/invites/:token', publicLimiter, getInviteInfo)
router.get('/public/notes/:slug', publicLimiter, getPublicNote)

router.use(requireSupabaseAuth)

router.get('/me', getMe)
router.patch('/me', updateMe)
router.get('/auth/refresh', refreshSession)
router.post('/auth/sign-out-everywhere', signOutEverywhere)
router.post('/auth/2fa/enroll/request', requestTwoFactorEnroll)
router.post('/auth/2fa/enroll/verify', verifyTwoFactorEnroll)
router.post('/auth/2fa/disable', disableTwoFactor)
router.post('/upgrade-intents', createUpgradeIntent)
router.get('/invites', listMyInvites)

router.get('/admin/users', requireAdmin, listAdminUsers)
router.patch('/admin/users/:id/plan', requireAdmin, updateAdminUserPlan)

router.get('/workspaces', listWorkspaces)
router.post('/workspaces', idempotencyWorkspace, createWorkspace)
router.patch('/workspaces/:id', updateWorkspace)
router.delete('/workspaces/:id', deleteWorkspace)
router.get('/workspaces/:id/members', listWorkspaceMembers)
router.get('/workspaces/:id/invites', listWorkspaceInvites)
router.delete('/workspaces/:id/members/:userId', removeWorkspaceMember)
router.post('/workspaces/:id/leave', leaveWorkspace)
router.post('/workspaces/:id/invites', idempotencyInvite, createInvite)
router.post('/invites/:token/accept', acceptInvite)
router.post('/invites/:token/decline', declineInvite)
router.get('/workspaces/:id/groups', listGroups)
router.post('/workspaces/:id/groups', idempotencyGroup, createGroup)
router.delete('/workspaces/:id/groups/:groupId', deleteGroup)
router.get('/workspaces/:id/notes', listNotes)
router.post('/workspaces/:id/notes', idempotencyNote, createNote)
router.get('/notes/:id', getNote)
router.patch('/notes/:id', updateNote)
router.post('/notes/:id/toggle-pin', togglePin)
router.patch('/notes/:id/public', updateNotePublicStatus)
router.delete('/notes/:id', deleteNote)
router.delete('/notes/:id/permanent', deleteNotePermanently)
router.get('/workspaces/:id/trash', listTrashNotes)
router.post('/notes/:id/restore', restoreNote)
router.get('/notes/:id/versions', listNoteVersions)
router.get('/notes/:id/versions/:versionId', getNoteVersion)
router.post('/notes/:id/versions/:versionId/restore', restoreNoteVersion)
router.get('/notes/:id/attachments', listNoteAttachments)
router.post('/notes/:id/attachments', createNoteAttachment)
router.delete('/notes/:id/attachments/:attachmentId', deleteNoteAttachment)
router.get('/ably/auth', readLimiterLow, createAblyToken)
router.get('/workspaces/:id/chat/messages', listChatMessages)
router.get('/workspaces/:id/chat/mentions', listChatMentions)
router.get('/workspaces/:id/chat/audits', listChatAudits)
router.get('/workspaces/:id/chat/unread', getChatUnreadCounts)
router.post('/workspaces/:id/chat/messages', createChatMessage)
router.patch('/workspaces/:id/chat/messages/:messageId', updateChatMessage)
router.delete('/workspaces/:id/chat/messages/:messageId', deleteChatMessage)
router.post('/workspaces/:id/chat/messages/:messageId/reactions', createChatReaction)
router.delete('/workspaces/:id/chat/messages/:messageId/reactions/:emoji', deleteChatReaction)
router.post('/workspaces/:id/chat/mentions/read', markChatMentionsRead)
router.post('/workspaces/:id/chat/uploads', createChatUpload)
router.post('/workspaces/:id/chat/events', requireAdmin, publishChatEvent)
router.get('/workspaces/:id/analytics', getWorkspaceAnalytics)
router.get('/workspaces/:id/audit-logs', listWorkspaceAuditLogs)

// AI endpoints (scaffold)
import { ingestNote, askWorkspace, streamWorkspace, debugAi } from '../controllers/aiController.js'

router.post('/ai/ingest', ingestNote)
router.post('/ai/ask', askWorkspace)
router.post('/ai/stream', streamWorkspace)
router.post('/ai/debug', requireAdmin, debugAi)

export { router as apiRouter }
