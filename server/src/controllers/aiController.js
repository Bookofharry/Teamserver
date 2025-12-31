import logger from '../utils/logger.js'
import { chunkAndEmbed } from '../ai/embeddings.js'
import { upsertVectors, queryVectors } from '../ai/vectorStore.js'
import { generateAnswer } from '../ai/aiClient.js'

export async function ingestNote(req, res) {
  const { noteId, workspaceId, content, version } = req.body
  if (!noteId || !workspaceId || typeof content !== 'string') {
    return res.status(400).json({ error: 'noteId, workspaceId, and content are required' })
  }

  try {
    const chunks = await chunkAndEmbed(content)
    const rows = chunks.map((c, idx) => ({
      note_id: noteId,
      workspace_id: workspaceId,
      version: version || 1,
      chunk_text: c.text,
      embedding: c.embedding,
    }))

    await upsertVectors(rows)
    return res.status(200).json({ ok: true, count: rows.length })
  } catch (err) {
    logger.error({ err }, 'ingestNote failed')
    return res.status(500).json({ error: 'ingest_failed' })
  }
}

export async function askWorkspace(req, res) {
  const { workspaceId, prompt } = req.body
  if (!workspaceId || !prompt) return res.status(400).json({ error: 'workspaceId and prompt required' })

  try {
    // For now compute an embedding for the prompt
    const embedding = await (async () => {
      const es = await (await import('../ai/aiClient.js')).embedTexts([prompt])
      return es[0]
    })()

    const results = await queryVectors({ workspaceId, queryEmbedding: embedding, topK: 8 })

    // Combine top chunks into context
    const context = (results || []).map((r) => `--- [note:${r.note_id} | ver:${r.version}]\n${r.chunk_text}`).join('\n')

    const { text } = await generateAnswer(`Use the following notes as context:\n${context}\n\nUser question: ${prompt}`)

    return res.status(200).json({ answer: text, sources: results })
  } catch (err) {
    logger.error({ err }, 'askWorkspace failed')
    return res.status(500).json({ error: 'ask_failed' })
  }
}

export async function streamWorkspace(req, res) {
  const { workspaceId, prompt } = req.body
  if (!workspaceId || !prompt) return res.status(400).json({ error: 'workspaceId and prompt required' })

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  // Compute embedding & fetch relevant chunks
  try {
    const embedding = (await (await import('../ai/aiClient.js')).embedTexts([prompt]))[0]
    const results = await queryVectors({ workspaceId, queryEmbedding: embedding, topK: 8 })
    const context = (results || []).map((r) => `--- [note:${r.note_id} | ver:${r.version}]\n${r.chunk_text}`).join('\n')

    const promptWithContext = `Use the following notes as context:\n${context}\n\nUser question: ${prompt}`

    const stream = await (await import('../ai/aiClient.js')).generateAnswerStream(promptWithContext)

    // when client disconnects
    req.on('close', () => {
      try {
        res.write('event: end\ndata: client_disconnected\n\n')
      } catch (e) {
        // ignore
      }
    })

    for await (const chunk of stream) {
      // Send each chunk as an SSE data event
      res.write(`data: ${chunk}\n\n`)
    }

    // Done
    res.write('event: end\ndata: done\n\n')
    res.end()
  } catch (err) {
    logger.error({ err }, 'streamWorkspace failed')
    try {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'stream_failed' })}\n\n`)
      res.end()
    } catch (e) {
      // noop
    }
  }
}
