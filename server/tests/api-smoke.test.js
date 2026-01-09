import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcrypt'

const nowIso = new Date('2025-01-01T00:00:00.000Z').toISOString()
const userId = 'user-1'
const workspaceId = 'ws-1'
const groupId = 'group-1'
let supabaseMock
let app

const createSupabaseMock = () => {
  const passwordHash = bcrypt.hashSync('password123', 8)
  const resolveResult = (state) => {
    const selectFields = String(state.selectFields || '')
    const isCount =
      state.selectOptions?.count === 'exact' && state.selectOptions?.head

    if (state.table === 'workspace_members') {
      if (selectFields.includes('profiles!inner')) {
        return { data: null, error: null }
      }
      if (selectFields.includes('workspace_id')) {
        return { data: [{ workspace_id: workspaceId }], error: null }
      }
      if (selectFields.includes('role')) {
        return { data: { role: 'owner' }, error: null }
      }
      return {
        data: {
          id: 'member-1',
          workspace_id: workspaceId,
          user_id: userId,
          role: 'owner',
          created_at: nowIso,
        },
        error: null,
      }
    }

    if (state.table === 'workspaces') {
      if (state.method === 'maybeSingle') {
        return { data: { name: 'Workspace' }, error: null }
      }
      return {
        data: [
          {
            id: workspaceId,
            name: 'Workspace',
            owner_id: userId,
            created_at: nowIso,
          },
        ],
        error: null,
      }
    }

    if (state.table === 'profiles') {
      return {
        data: {
          is_subscribed: false,
          plan: 'free',
          full_name: 'Test User',
          email: 'test@example.com',
          avatar_url: null,
        },
        error: null,
      }
    }

    if (state.table === 'users') {
      return {
        data: {
          id: userId,
          email: 'test@example.com',
          password_hash: passwordHash,
        },
        error: null,
      }
    }

    if (state.table === 'groups') {
      return { data: { id: groupId }, error: null }
    }

    if (state.table === 'notes') {
      if (isCount) {
        return { count: 0, error: null }
      }
      if (state.action === 'insert') {
        return {
          data: {
            id: 'note-1',
            title: state.payload?.title || 'Untitled',
            body: state.payload?.body || '',
            workspace_id: workspaceId,
            group_id: groupId,
            tags: state.payload?.tags || [],
            is_pinned: false,
            is_public: false,
            public_slug: null,
            public_published_at: null,
            public_expires_at: null,
            created_at: nowIso,
            updated_at: nowIso,
            updated_by_id: userId,
          },
          error: null,
        }
      }
      return { data: [], error: null }
    }

    if (state.table === 'workspace_invites') {
      if (state.action === 'insert') {
        return {
          data: {
            id: 'invite-1',
            workspace_id: workspaceId,
            email: state.payload?.email || 'new@example.com',
            role: state.payload?.role || 'member',
            token: 'invite_token',
            expires_at: nowIso,
            created_by: userId,
            created_at: nowIso,
          },
          error: null,
        }
      }
      return { data: null, error: null }
    }

    return { data: [], error: null }
  }

  const createBuilder = (table) => {
    const state = {
      table,
      action: 'select',
      method: 'then',
      selectFields: null,
      selectOptions: null,
      payload: null,
    }

    const builder = {
      select: (fields, options) => {
        state.selectFields = fields
        state.selectOptions = options
        return builder
      },
      insert: (payload) => {
        state.action = 'insert'
        state.payload = payload
        return builder
      },
      update: (payload) => {
        state.action = 'update'
        state.payload = payload
        return builder
      },
      delete: () => {
        state.action = 'delete'
        return builder
      },
      upsert: async () => ({ data: null, error: null }),
      eq: () => builder,
      gt: () => builder,
      lt: () => builder,
      is: () => builder,
      in: () => builder,
      order: () => builder,
      range: (from, to) => {
        state.method = 'range'
        state.range = { from, to }
        return builder
      },
      single: () => {
        state.method = 'single'
        return builder
      },
      maybeSingle: () => {
        state.method = 'maybeSingle'
        return builder
      },
      then: (resolve, reject) => {
        Promise.resolve(resolveResult(state)).then(resolve, reject)
      },
    }

    return builder
  }

  return {
    from: (table) => createBuilder(table),
    rpc: () => ({
      single: async () => ({
        data: {
          id: workspaceId,
          name: 'Workspace',
          owner_id: userId,
          created_at: nowIso,
        },
        error: null,
      }),
    }),
  }
}

vi.mock('../src/db/supabase.js', () => ({
  getSupabaseAdmin: () => supabaseMock,
  handleSupabaseError: (res, _error, message = 'Database error') =>
    res.status(500).json({ error: { code: 'database_error', message } }),
}))

vi.mock('../src/auth/supabaseAuth.js', () => ({
  requireSupabaseAuth: (req, _res, next) => {
    req.auth = {
      userId,
      email: 'test@example.com',
      role: 'authenticated',
      userMetadata: { full_name: 'Test User' },
      appMetadata: {},
    }
    next()
  },
  verifySupabaseToken: async () => ({
    sub: userId,
    email: 'test@example.com',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  createAuthToken: async () => 'test-token',
  buildAuthCookieOptions: () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
  }),
  getAuthCookieName: () => 'teampad_session',
}))

vi.mock('../src/utils/events.js', () => ({ logEvent: async () => {} }))
vi.mock('../src/utils/email.js', () => ({
  sendWorkspaceInviteEmail: async () => ({ sent: true, messageId: 'test' }),
  sendPasswordResetEmail: async () => ({ sent: false, reason: 'test' }),
}))

const getApp = async () => {
  if (!app) {
    const mod = await import('../src/app.js')
    app = mod.app
  }
  return app
}

beforeEach(() => {
  supabaseMock = createSupabaseMock()
})

describe('API smoke', () => {
  it('creates a session and sets a cookie', async () => {
    const target = await getApp()
    const res = await request(target)
      .post('/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']?.join('')).toContain('teampad_session')
  })

  it('creates a note', async () => {
    const target = await getApp()
    const res = await request(target)
      .post(`/v1/workspaces/${workspaceId}/notes`)
      .send({ groupId, title: 'Hello', body: 'World' })
    expect(res.status).toBe(201)
    expect(res.body?.data?.id).toBe('note-1')
  })

  it('creates a workspace invite', async () => {
    const target = await getApp()
    const res = await request(target)
      .post(`/v1/workspaces/${workspaceId}/invites`)
      .send({ email: 'new@example.com', role: 'member' })
    expect(res.status).toBe(201)
    expect(res.body?.data?.token).toBe('invite_token')
  })
})
