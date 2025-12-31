import logger from '../utils/logger.js'
import { getSupabaseAdmin, handleSupabaseError } from '../db/supabase.js'

// Minimal Supabase vector store helpers. Assumes a table `note_vectors` exists with columns:
// id (uuid primary), note_id (uuid), workspace_id (uuid), version (int), chunk_text (text), embedding (vector), created_at

const TABLE = process.env.SUPABASE_VECTORS_TABLE || 'note_vectors'

export async function upsertVectors(rows = []) {
  if (!rows.length) return []
  const supabase = getSupabaseAdmin()
  try {
    const { data, error } = await supabase.from(TABLE).upsert(rows)
    if (error) throw error
    return data
  } catch (err) {
    logger.error({ err }, 'Failed upserting vectors')
    throw err
  }
}

export async function queryVectors({ workspaceId, queryEmbedding, topK = 10 } = {}) {
  const supabase = getSupabaseAdmin()
  try {
    // Use Postgres pgvector extension via Supabase similarity query
    const { data, error } = await supabase
      .rpc('match_note_vectors', { workspace_id_param: workspaceId, query_embedding: queryEmbedding, match_count: topK })

    if (error) throw error
    return data || []
  } catch (err) {
    logger.error({ err }, 'Failed querying vectors')
    throw err
  }
}
