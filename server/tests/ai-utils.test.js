import { describe, it, expect } from 'vitest'
import { chunkText } from '../src/ai/utils.js'

describe('chunkText', () => {
  it('chunks text into expected sizes and overlaps', () => {
    const text = 'a'.repeat(3000)
    const chunks = chunkText(text, { chunkSize: 1000, chunkOverlap: 100 })
    // expect overlapping chunks and multiple chunks
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    expect(chunks[0].length).toBe(1000)
    expect(chunks[1].length).toBe(1000)
  })
})
