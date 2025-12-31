// Minimal Gemini client stub for embeddings and streaming text generation.
// This file implements a thin wrapper around HTTP calls to a Gemini /responses-like endpoint.
// Configure with GEMINI_API_URL and GEMINI_API_KEY (or use Google AI Studio / Antigravity settings).

import logger from '../utils/logger.js'

const GEMINI_API_URL = process.env.GEMINI_API_URL || ''
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

export async function embedTexts(texts = []) {
  if (!GEMINI_API_URL || !GEMINI_API_KEY) {
    logger.error('Gemini embedding called but GEMINI_API_URL or GEMINI_API_KEY not set')
    throw new Error('Gemini not configured')
  }

  // NOTE: The exact Gemini embedding API may differ; this is a generic POST to a /embeddings endpoint.
  const res = await fetch(`${GEMINI_API_URL}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify({ input: texts }),
  })

  if (!res.ok) {
    const txt = await res.text()
    logger.error({ status: res.status, text: txt }, 'Gemini embeddings error')
    throw new Error('Gemini embedding failed')
  }

  const body = await res.json()
  // Expect body.data = [{embedding: [...]}, ...] similar to other APIs
  const out = (body.data || []).map((d) => d.embedding || d.vector || null)
  return out
}

// Non-streaming generation (simple wrapper)
export async function generateAnswer(prompt, opts = {}) {
  if (!GEMINI_API_URL || !GEMINI_API_KEY) throw new Error('Gemini not configured')
  const res = await fetch(`${GEMINI_API_URL}/v1/responses:generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify({ prompt, max_tokens: opts.maxTokens || 512 }),
  })

  if (!res.ok) {
    const txt = await res.text()
    logger.error({ status: res.status, text: txt }, 'Gemini generate error')
    throw new Error('Gemini generation failed')
  }

  const body = await res.json()
  // Adapt to actual Gemini response shape
  const text = (body.output_text || (body?.candidates && body.candidates[0]?.content) || body.text || '')
  return { text, meta: body }
}

// Streaming generation: returns an async iterator that yields string chunks as they arrive.
export async function* generateAnswerStream(prompt, opts = {}) {
  if (!GEMINI_API_URL || !GEMINI_API_KEY) throw new Error('Gemini not configured')

  // Start a fetch that expects chunked NDJSON or event-stream responses from Gemini. The exact format may vary.
  const res = await fetch(`${GEMINI_API_URL}/v1/responses:stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GEMINI_API_KEY}`,
    },
    body: JSON.stringify({ prompt, max_tokens: opts.maxTokens || 2048 }),
  })

  if (!res.ok) {
    const txt = await res.text()
    logger.error({ status: res.status, text: txt }, 'Gemini streaming init failed')
    throw new Error('Gemini streaming failed')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // Try to split by newlines (NDJSON) or by event boundaries
    let idx
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      // Some streams send 'data: {...}' etc. Try to parse JSON inside
      const l = line.replace(/^data:\s*/, '')
      try {
        const obj = JSON.parse(l)
        // Attempt to extract text chunk
        const chunk = obj.delta?.content || obj.content || obj.text || obj.output_text
        if (chunk) yield chunk
      } catch (e) {
        // Not JSON — just yield the raw line
        yield l
      }
    }
  }

  if (buf.trim()) {
    yield buf
  }
}
