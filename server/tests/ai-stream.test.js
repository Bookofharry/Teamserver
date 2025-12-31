import { describe, it, expect } from 'vitest'
import { generateAnswerStream } from '../src/ai/aiClient.js'

describe('generateAnswerStream (mock provider)', () => {
  it('streams chunks as async iterable', async () => {
    process.env.AI_PROVIDER = 'mock'
    const iter = await generateAnswerStream('what are the key points?')
    let out = ''
    for await (const chunk of iter) {
      out += chunk
    }
    expect(out).toContain('MOCK STREAM START')
    expect(out).toContain('MOCK STREAM END')
  })
})
