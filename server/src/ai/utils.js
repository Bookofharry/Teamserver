// Utility helpers for AI pipeline

export function chunkText(text = '', { chunkSize = 1200, chunkOverlap = 100 } = {}) {
  if (!text) return []
  const out = []
  let i = 0
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize)
    out.push(chunk)
    i += chunkSize - chunkOverlap
  }
  return out
}
