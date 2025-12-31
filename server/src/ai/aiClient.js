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
    // TODO: implement real Gemini embedding calls using the Gemini API client
    logger.info('Embedding via Gemini not yet implemented')
    throw new Error('Gemini embedding not implemented')
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
    // TODO: implement real Gemini call (streaming support later)
    logger.info('Gemini generate not yet implemented')
    throw new Error('Gemini generate not implemented')
  }

  throw new Error(`Unknown AI_PROVIDER=${provider}`)
}
