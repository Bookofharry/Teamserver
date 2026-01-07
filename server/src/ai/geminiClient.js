// Gemini client — production-ready helper for embeddings and streaming text generation.
// - Reads config from GEMINI_API_URL and GEMINI_API_KEY.
// - Provides timeouts, retries with exponential backoff, and streaming parsing that tolerates NDJSON or SSE-like 'data:' lines.
// - Streaming function supports AbortSignal via opts.signal.

import logger from '../utils/logger.js'
import { generateStructuredAnswer, streamStructuredAnswer } from '../services/gemini.js'

const DEFAULT_TIMEOUT = Number(process.env.GEMINI_TIMEOUT_MS) || 15_000
const DEFAULT_RETRIES = Number(process.env.GEMINI_RETRIES) || 2
const DEFAULT_MAX_TOKENS = Number(process.env.GEMINI_MAX_TOKENS) || 2048
const DEFAULT_CHAT_MODEL = (process.env.GEMINI_CHAT_MODEL || 'gemini-2.0-flash').trim()
const DEFAULT_EMBEDDING_MODEL = (process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004').trim()
const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const resolveGeminiConfig = () => {
  const rawUrl = (process.env.GEMINI_API_URL || '').trim()
  const apiKey = (process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    logger.warn('Gemini client called but GEMINI_API_KEY not set')
    throw new Error('Gemini not configured')
  }

  if (!rawUrl) {
    return {
      baseUrl: DEFAULT_GEMINI_BASE_URL,
      apiKey,
      chatModel: DEFAULT_CHAT_MODEL,
      embedModel: DEFAULT_EMBEDDING_MODEL,
    }
  }

  const cleaned = rawUrl.replace(/\/$/, '')
  const modelMatch = cleaned.match(/^(https?:\/\/[^/]+)(?:\/v1beta)?\/models\/([^/:]+)$/)
  if (modelMatch) {
    return {
      baseUrl: `${modelMatch[1]}/v1beta`,
      apiKey,
      chatModel: modelMatch[2],
      embedModel: DEFAULT_EMBEDDING_MODEL,
    }
  }

  const baseUrl = cleaned.includes('/v1beta') ? cleaned.replace(/\/v1beta.*$/, '/v1beta') : cleaned
  return {
    baseUrl,
    apiKey,
    chatModel: DEFAULT_CHAT_MODEL,
    embedModel: DEFAULT_EMBEDDING_MODEL,
  }
}


async function fetchWithTimeout(url, opts = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const signal = opts.signal
  const combined = signal
    ? new AbortController()
    : controller

  // If external signal provided, forward abort
  if (signal) {
    signal.addEventListener('abort', () => combined.abort())
  }

  const finalSignal = combined.signal || controller.signal
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { ...opts, signal: finalSignal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function retryable(fn, attempts = DEFAULT_RETRIES) {
  let lastErr
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const backoff = Math.min(1000 * Math.pow(2, i), 5000) + Math.floor(Math.random() * 100)
      logger.warn({ attempt: i + 1, error: err?.message }, 'Gemini request failed, retrying')
      await sleep(backoff)
    }
  }
  throw lastErr
}

const parseRetryAfterSeconds = (value) => {
  if (!value) return null
  if (typeof value === 'number') return value
  const trimmed = String(value).trim().toLowerCase()
  if (trimmed.endsWith('s')) {
    const num = Number(trimmed.replace('s', ''))
    return Number.isFinite(num) ? num : null
  }
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

const buildGeminiError = async (res, fallbackMessage) => {
  const text = await res.text().catch(() => '')
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch (e) {
    parsed = null
  }
  const message =
    parsed?.error?.message ||
    text ||
    res.statusText ||
    fallbackMessage ||
    'Gemini request failed'
  const err = new Error(message)
  err.status = res.status
  err.code = parsed?.error?.status || parsed?.error?.code || null
  const retryInfo = parsed?.error?.details?.find((detail) =>
    String(detail?.['@type'] || '').includes('RetryInfo'),
  )
  err.retryAfterSeconds = parseRetryAfterSeconds(retryInfo?.retryDelay || null)
  err.raw = text
  return err
}

export async function embedTexts(texts = [], opts = {}) {
  const { baseUrl, apiKey, embedModel } = resolveGeminiConfig()
  if (!Array.isArray(texts)) throw new Error('texts must be an array')
  const embedModelName = embedModel.startsWith('models/') ? embedModel : `models/${embedModel}`

  const res = await retryable(() =>
    fetchWithTimeout(`${baseUrl}/models/${embedModel}:batchEmbedContents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: embedModelName,
          content: { parts: [{ text: String(text) }] },
        })),
      }),
      signal: opts.signal,
    }, opts.timeout || DEFAULT_TIMEOUT),
  )

  if (!res.ok) {
    const error = await buildGeminiError(res, 'Gemini embedding failed')
    logger.error({ status: res.status, text: error.raw }, 'Gemini embeddings error')
    throw error
  }

  const parsed = await res.json().catch(() => null)
  const embeddings = parsed?.embeddings || parsed?.data || []
  return embeddings.map((d) => d?.values || d?.embedding || d?.vector || null)
}

export async function generateAnswer(prompt, opts = {}) {
  try {
    const { text, response } = await generateStructuredAnswer(prompt, {
      maxTokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
      model: resolveGeminiConfig().chatModel || DEFAULT_CHAT_MODEL,
    })
    return { text, meta: response }
  } catch (err) {
    logger.error({ err }, 'Gemini generate error')
    throw err
  }
}

// Streaming generation: returns an async iterator that yields string chunks as they arrive.
export async function* generateAnswerStream(prompt, opts = {}) {
  try {
    const stream = streamStructuredAnswer(prompt, {
      maxTokens: opts.maxTokens || DEFAULT_MAX_TOKENS,
      model: resolveGeminiConfig().chatModel || DEFAULT_CHAT_MODEL,
    })
    for await (const chunk of stream) yield chunk
  } catch (err) {
    logger.error({ err }, 'Gemini streaming init failed')
    throw err
  }
}
