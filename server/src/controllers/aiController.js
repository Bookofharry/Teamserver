import logger from '../utils/logger.js'
import { chunkAndEmbed } from '../ai/embeddings.js'
import { upsertVectors } from '../ai/vectorStore.js'
import { generateAnswer } from '../ai/aiClient.js'
import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'
import { resolvePlanForUser } from '../utils/plan.js'
import { requireWorkspaceMember } from './helpers.js'
import { toAiAskResponse, toAiDebugResponse, toAiIngestResponse, toAiStreamErrorResponse } from '../dto/responses/ai.js'

const AI_TONE_GUIDE =
  'You are TeamPad AI, a friendly, practical assistant. Keep answers simple, smart, and easy to skim. ' +
  'Use short paragraphs or bullets, avoid jargon, and be specific. ' +
  'Always respond with these sections: Summary, Action Items, Open Questions. ' +
  'If a section has nothing, say "None." ' +
  'If the user asks to create, edit, or delete anything, propose the change and ask for confirmation before applying it. ' +
  'If the notes do not contain enough context, say so plainly.'
const MAX_AI_PROMPT_CHARS = 2000

const getRateLimitMessage = (err) => {
  const message = String(err?.message || '')
  const isRateLimited =
    err?.status === 429 ||
    err?.code === 429 ||
    /resource_exhausted|quota|rate limit|too many requests|429/i.test(message)
  if (!isRateLimited) return null
  const retryAfterSeconds = err?.retryAfterSeconds
  if (retryAfterSeconds) {
    return `AI is temporarily rate limited. Please retry in about ${retryAfterSeconds}s.`
  }
  return 'AI is temporarily rate limited. Please retry in a moment.'
}

const loadPlanContext = async (req, res) => {
  const supabase = getSupabaseAdmin()
  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('plan, is_subscribed')
    .eq('id', req.auth.userId)
    .maybeSingle()
  if (error) {
    handleSupabaseError(res, error, 'Failed to load profile')
    return null
  }
  const authPlan = req.auth?.appMetadata?.plan || req.auth?.userMetadata?.plan
  const resolvedPlan = resolvePlanForUser({
    profilePlan: profileRow?.plan,
    authPlan,
    isSubscribed: profileRow?.is_subscribed,
    email: req.auth.email,
    userId: req.auth.userId,
  })
  return {
    resolvedPlan,
    profilePlan: profileRow?.plan || null,
    authPlan: authPlan || null,
    isSubscribed: profileRow?.is_subscribed || false,
  }
}

const ensureAiAccess = async (req, res) => {
  const planContext = await loadPlanContext(req, res)
  if (!planContext) return null
  if (planContext.resolvedPlan !== 'premium_plus') {
    logger.info(
      {
        userId: req.auth.userId,
        plan: planContext.resolvedPlan,
        profilePlan: planContext.profilePlan,
        authPlan: planContext.authPlan,
        isSubscribed: planContext.isSubscribed,
      },
      'The gatekeeper says NO.',
    )
    res.status(403).json({
      error: { code: 'plan_limit', message: 'Upgrade to Premium+ to use TeamPad AI.' },
    })
    return null
  }
  return planContext.resolvedPlan
}

export async function ingestNote(req, res) {
  const { noteId, workspaceId, content, version } = req.body
  if (!noteId || !workspaceId || typeof content !== 'string') {
    return res.status(400).json({ error: 'noteId, workspaceId, and content are required' })
  }
  if (!(await requireWorkspaceMember(req, res, workspaceId))) return
  if (!await ensureAiAccess(req, res)) return
  const contentLength = content.length
  logger.info(
    { userId: req.auth.userId, noteId, workspaceId, contentLength, version: version || 1 },
    'Feeding the machine...',
  )

  const supabase = getSupabaseAdmin()
  const { data: noteRow, error: noteError } = await supabase
    .from('notes')
    .select('id')
    .eq('id', noteId)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (noteError) {
    return handleSupabaseError(res, noteError, 'Failed to load note')
  }
  if (!noteRow) {
    return res.status(404).json({ error: 'note not found' })
  }

  try {
    const chunks = await chunkAndEmbed(content)
    const rows = chunks.map((c, idx) => ({
      note_id: noteId,
      workspace_id: workspaceId,
      version: version || 1,
      chunk_text: c.text,
      embedding: c.embedding,
    }))

    await upsertVectors(rows)
    logger.info(
      { userId: req.auth.userId, noteId, workspaceId, chunkCount: rows.length },
      'The machine is satiated.',
    )
    return res.status(200).json({ data: toAiIngestResponse({ ok: true, count: rows.length }) })
  } catch (err) {
    logger.error({ err }, 'ingestNote failed')
    return res.status(500).json({ error: 'ingest_failed' })
  }
}

export async function askWorkspace(req, res) {
  const { workspaceId, prompt } = req.body
  if (!workspaceId || !prompt) return res.status(400).json({ error: 'workspaceId and prompt required' })
  if (String(prompt).length > MAX_AI_PROMPT_CHARS) {
    return res.status(400).json({ error: { code: 'prompt_too_long', message: 'Prompt is too long' } })
  }
  if (!(await requireWorkspaceMember(req, res, workspaceId))) return
  if (!await ensureAiAccess(req, res)) return

  try {
    const startedAt = Date.now()
    logger.info(
      { userId: req.auth.userId, workspaceId, promptLength: String(prompt).length },
      'Consulting the digital oracle...',
    )
    const promptWithContext =
      `${AI_TONE_GUIDE}\n\n` +
      `User request: ${prompt}`

    const { text } = await generateAnswer(promptWithContext)

    logger.info(
      {
        userId: req.auth.userId,
        workspaceId,
        resultsCount: 0,
        answerLength: text?.length || 0,
        durationMs: Date.now() - startedAt,
      },
      'The oracle has spoken.',
    )
    return res.status(200).json({ data: toAiAskResponse({ answer: text, sources: [] }) })
  } catch (err) {
    const rateMessage = getRateLimitMessage(err)
    if (rateMessage) {
      return res.status(429).json({ error: { code: 'ai_rate_limited', message: rateMessage } })
    }
    logger.error({ err }, 'askWorkspace failed')
    return res.status(500).json({ error: 'ask_failed' })
  }
}

export async function streamWorkspace(req, res) {
  const { workspaceId, prompt } = req.body
  if (!workspaceId || !prompt) return res.status(400).json({ error: 'workspaceId and prompt required' })
  if (String(prompt).length > MAX_AI_PROMPT_CHARS) {
    return res.status(400).json({ error: { code: 'prompt_too_long', message: 'Prompt is too long' } })
  }
  if (!(await requireWorkspaceMember(req, res, workspaceId))) return
  if (!await ensureAiAccess(req, res)) return

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  // Compute embedding & fetch relevant chunks
  try {
    const startedAt = Date.now()
    logger.info(
      { userId: req.auth.userId, workspaceId, promptLength: String(prompt).length },
      'Opening the neural conduit...',
    )
    const promptWithContext =
      `${AI_TONE_GUIDE}\n\n` +
      `User request: ${prompt}`

    const stream = await (await import('../ai/aiClient.js')).generateAnswerStream(promptWithContext)
    const resultsCount = 0
    let chunkCount = 0
    let charCount = 0

    // when client disconnects
    req.on('close', () => {
      try {
        res.write('event: end\ndata: client_disconnected\n\n')
      } catch (e) {
        // ignore
      }
    })

    for await (const chunk of stream) {
      const chunkText = String(chunk)
      chunkCount += 1
      charCount += chunkText.length
      // Send each chunk as an SSE data event
      res.write(`data: ${chunkText}\n\n`)
    }

    logger.info(
      {
        userId: req.auth.userId,
        workspaceId,
        resultsCount,
        chunkCount,
        charCount,
        durationMs: Date.now() - startedAt,
      },
      'Neural link severed.',
    )
    // Done
    res.write('event: end\ndata: done\n\n')
    res.end()
  } catch (err) {
    const rateMessage = getRateLimitMessage(err)
    if (rateMessage) {
      try {
        res.write(`event: error\ndata: ${JSON.stringify(toAiStreamErrorResponse({ error: 'ai_rate_limited', message: rateMessage }))}\n\n`)
        res.end()
      } catch (e) {
        // noop
      }
      return
    }
    logger.error(
      { err, userId: req.auth.userId, workspaceId },
      'streamWorkspace failed',
    )
    try {
      res.write(`event: error\ndata: ${JSON.stringify(toAiStreamErrorResponse({ error: 'stream_failed' }))}\n\n`)
      res.end()
    } catch (e) {
      // noop
    }
  }
}

export async function debugAi(req, res) {
  const { workspaceId } = req.body || {}
  const planContext = await loadPlanContext(req, res)
  if (!planContext) return

  let membership = null
  if (workspaceId) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', req.auth.userId)
      .maybeSingle()

    if (error) {
      return res.status(500).json({ error: { code: 'database_error', message: 'Failed to check membership' } })
    }
    membership = Boolean(data)
  }

  const provider = process.env.AI_PROVIDER || 'mock'
  const geminiApiUrl = (process.env.GEMINI_API_URL || '').trim()
  const geminiKeySet = Boolean((process.env.GEMINI_API_KEY || '').trim())
  const geminiChatModel = (process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash').trim()
  const geminiEmbeddingModel = (process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004').trim()

  const canUseAi = planContext.resolvedPlan === 'premium_plus'
  let ping = { ok: false, provider, error: null }
  if (!canUseAi) {
    ping = { ok: false, provider, error: 'plan_limit' }
  } else {
    try {
      const { text } = await generateAnswer('Reply with OK.')
      ping = { ok: true, provider, error: null, sample: String(text || '').slice(0, 80) }
    } catch (err) {
      ping = { ok: false, provider, error: err?.message || 'ping_failed' }
    }
  }

  return res.status(200).json({
    data: toAiDebugResponse({
      auth: {
        userId: req.auth.userId,
        email: req.auth.email || null,
      },
      plan: {
        resolvedPlan: planContext.resolvedPlan,
        profilePlan: planContext.profilePlan,
        authPlan: planContext.authPlan,
        isSubscribed: planContext.isSubscribed,
        allowed: canUseAi,
      },
      membership: workspaceId ? { workspaceId, isMember: membership } : null,
      provider: {
        name: provider,
        gemini: {
          apiUrlSet: Boolean(geminiApiUrl),
          apiKeySet: geminiKeySet,
          chatModel: geminiChatModel,
          embeddingModel: geminiEmbeddingModel,
        },
      },
      ping,
    }),
  })
}
