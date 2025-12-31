import { describe, it, expect } from 'vitest'
import { embedTexts, generateAnswer } from '../src/ai/aiClient.js'

describe('aiClient (mock)', () => {
  it('returns embeddings for texts', async () => {
    const es = await embedTexts(['hello', 'world'])
    expect(es.length).toBe(2)
    expect(es[0].length).toBeGreaterThan(0)
  })

  it('generateAnswer returns mock text', async () => {
    const r = await generateAnswer('what is up')
    expect(r.text).toContain('MOCK ANSWER')
  })
})
