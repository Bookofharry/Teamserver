// Minimal AI client wrapper — supports 'mock' provider and Gemini (placeholder)
// Provider is chosen via process.env.AI_PROVIDER (mock|gemini)

import logger from '../utils/logger.js'

const provider = process.env.AI_PROVIDER || 'mock'

export async function embedTexts(texts = []) {
  if (provider === 'mock') {
    // Simple deterministic mock embedding: hash-like values
    return texts.map((t, i) => Array.from({ length: 3 }, (_, j) => (i + 1) * (j + 1)))
  }

  if (provider === 'gemini') {
    const { embedTexts: geminiEmbed } = await import('./geminiClient.js')
    return geminiEmbed(texts)
  }

  throw new Error(`Unknown AI_PROVIDER=${provider}`)
}

export async function generateAnswer(prompt, opts = {}) {
  if (provider === 'mock') {
    // Very simple mock: echo the prompt with a canned note
    return {
      text: `MOCK ANSWER: Based on the provided notes, here is a short summary for your query: ${prompt}`,
      tokens: 10,
    }
  }

  if (provider === 'gemini') {
    const { generateAnswer: geminiGenerate } = await import('./geminiClient.js')
    return geminiGenerate(prompt, opts)
  }

  throw new Error(`Unknown AI_PROVIDER=${provider}`)
}

// Streaming interface: returns an async iterable yielding string chunks
export async function generateAnswerStream(prompt, opts = {}) {
  if (provider === 'mock') {
    async function* gen() {
      const parts = `MOCK STREAM START: ${prompt}`.split(' ')
      for (const p of parts) {
        await new Promise((r) => setTimeout(r, 5))
        yield p + ' '
      }
      yield '\n[MOCK STREAM END]'
    }
    return gen()
  }

  if (provider === 'gemini') {
    const { generateAnswerStream: geminiStream } = await import('./geminiClient.js')
    return geminiStream(prompt, opts)
  }

  throw new Error(`Unknown AI_PROVIDER=${provider}`)
}
