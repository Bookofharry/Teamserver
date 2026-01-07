import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { embedTexts, generateAnswer, generateAnswerStream } from '../src/ai/geminiClient.js'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('geminiClient', () => {
  it('embedTexts parses embedding response', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [1, 2, 3] }, { embedding: [4, 5, 6] }] }),
    })

    process.env.GEMINI_API_URL = 'https://api.gemini.test'
    process.env.GEMINI_API_KEY = 'test-key'

    const out = await embedTexts(['a', 'b'])
    expect(out.length).toBe(2)
    expect(out[0][0]).toBe(1)
  })

  it('generateAnswer returns text', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ output_text: 'hello world' }),
    })

    process.env.GEMINI_API_URL = 'https://api.gemini.test'
    process.env.GEMINI_API_KEY = 'test-key'

    const r = await generateAnswer('hello')
    expect(r.text).toBe('hello world')
  })

  it('generateAnswerStream yields chunks from NDJSON/data lines', async () => {
    // Mock a streaming response reader
    const encoder = new TextEncoder()
    const chunks = [
      encoder.encode('data: {"delta":{"content":"Hello"}}\n\n'),
      encoder.encode('data: {"delta":{"content":" world"}}\n\n'),
    ]

    let i = 0
    const reader = {
      read: async () => {
        if (i >= chunks.length) return { done: true, value: null }
        const v = chunks[i++]
        // simulate a small delay
        await new Promise((r) => setTimeout(r, 1))
        return { done: false, value: v }
      },
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => reader },
    })

    process.env.GEMINI_API_URL = 'https://api.gemini.test'
    process.env.GEMINI_API_KEY = 'test-key'

    const iter = generateAnswerStream('hi')
    let out = ''
    for await (const chunk of iter) {
      out += chunk
    }

    expect(out).toBe('Hello world')
  })
})