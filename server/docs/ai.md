AI integration notes

This file documents a minimal setup for the vector store using Supabase Postgres with `pgvector` extension.

1) Create table for note vectors

```sql
create extension if not exists vector;

create table if not exists note_vectors (
  id uuid default gen_random_uuid() primary key,
  note_id uuid not null,
  workspace_id uuid not null,
  version int not null default 1,
  chunk_text text not null,
  embedding vector(1536), -- adjust dim to your embedding provider
  created_at timestamptz default now()
);

create index on note_vectors using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

2) RPC helper for matching

```sql
create or replace function match_note_vectors(workspace_id_param uuid, query_embedding vector, match_count int)
returns table(id uuid, note_id uuid, workspace_id uuid, version int, chunk_text text, score float) as $$
  select id, note_id, workspace_id, version, chunk_text, 1 - (embedding <=> query_embedding) as score
  from note_vectors
  where workspace_id = workspace_id_param
  order by embedding <=> query_embedding
  limit match_count;
$$ language sql stable;
```

3) Notes
- Adjust embedding dimension to your provider.
- If using a managed vector DB instead, replace vector store functions in `server/src/ai/vectorStore.js`.

4) Gemini / AI provider configuration

- Environment variables (add these to `server/.env` or your secret manager):
  - `AI_PROVIDER` — `mock` or `gemini` (default: `mock`).
  - `GEMINI_API_URL` — Base URL for the Gemini API (e.g., `https://api.gemini.example`).
  - `GEMINI_API_KEY` — API key/secret used to authenticate requests. **Do not commit this to the repo.**
  - Optional tuning: `GEMINI_TIMEOUT_MS`, `GEMINI_RETRIES`, `GEMINI_MAX_TOKENS`.

- Notes:
  - The server will validate that `GEMINI_API_URL` and `GEMINI_API_KEY` are present when `AI_PROVIDER=gemini` and `NODE_ENV` is not `development`. This prevents accidental misconfiguration in production.
  - For local development you can set `AI_PROVIDER=mock` to avoid external API calls.
  - Keep secrets in a secure store (e.g., your cloud provider's secrets manager) and inject them into deployment environments; avoid storing them in code or unencrypted files.
