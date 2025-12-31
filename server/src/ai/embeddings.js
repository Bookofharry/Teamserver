import { embedTexts } from './aiClient.js'
import { chunkText } from './utils.js'

// Simple wrapper to chunk a text and compute embeddings for each chunk.
export async function chunkAndEmbed(text, { chunkSize = 1200, chunkOverlap = 100 } = {}) {
  const chunks = chunkText(text, { chunkSize, chunkOverlap })
  const embeddings = await embedTexts(chunks)
  return chunks.map((chunk, idx) => ({ text: chunk, embedding: embeddings[idx] }))
}
