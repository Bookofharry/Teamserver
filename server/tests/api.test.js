import request from 'supertest'
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import bcrypt from 'bcrypt'

let mockSupabase
let app
let server
let baseUrl

const seedStore = () => {
  const now = new Date().toISOString()
  const passwordHash = bcrypt.hashSync('password123', 8)
  return {
    users: [
      {
        id: 'user_1',
        email: 'alex@teampad.io',
        password_hash: passwordHash,
        created_at: now,
        last_login_at: null,
      },
    ],
    profiles: [
      {
        id: 'user_1',
        email: 'alex@teampad.io',
        full_name: 'Alex Johnson',
        avatar_url: null,
        plan: 'free',
        is_subscribed: false,
      },
    ],
    workspaces: [
      { id: 'ws_1', name: 'TeamPad', owner_id: 'user_1', created_at: now },
    ],
    workspace_members: [
      {
        id: 'wm_1',
        workspace_id: 'ws_1',
        user_id: 'user_1',
        role: 'owner',
        created_at: now,
      },
    ],
    groups: [
      {
        id: 'grp_1',
        workspace_id: 'ws_1',
        name: 'General',
        color: '#0EA5E9',
        created_at: now,
      },
    ],
    notes: [],
    workspace_invites: [],
    signup_otps: [],
    password_reset_tokens: [],
    upgrade_intents: [],
    idempotency_keys: [],
    event_logs: [],
    _counters: {},
  }
}

const createId = (store, table) => {
  store._counters[table] = (store._counters[table] || 0) + 1
  return `${table}_${store._counters[table]}`
}

const applyFilters = (rows, filters, store) =>
  rows.filter((row) =>
    filters.every((filter) => {
      const column = filter.column
      if (filter.type === 'eq') {
        if (column.includes('.')) {
          const [rel, field] = column.split('.')
          if (rel === 'profiles' && row.user_id) {
            const profile = store.profiles.find((profileRow) => profileRow.id === row.user_id)
            return profile?.[field] === filter.value
          }
        }
        return row[column] === filter.value
      }
      if (filter.type === 'gt') {
        return row[column] > filter.value
      }
      if (filter.type === 'lt') {
        return row[column] < filter.value
      }
      if (filter.type === 'is') {
        if (filter.value === null) return row[column] === null
        return row[column] === filter.value
      }
      if (filter.type === 'in') {
        return filter.value.includes(row[column])
      }
      return true
    }),
  )

class MockQuery {
  constructor(table, store) {
    this.table = table
    this.store = store
    this.filters = []
    this.orderBy = null
    this.rangeBounds = null
    this.selectOptions = null
    this.action = 'select'
    this.payload = null
  }

  select(_columns, options = {}) {
    this.selectOptions = options
    return this
  }

  insert(payload) {
    this.action = 'insert'
    this.payload = payload
    return this
  }

  update(payload) {
    this.action = 'update'
    this.payload = payload
    return this
  }

  upsert(payload) {
    this.action = 'upsert'
    this.payload = payload
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value })
    return this
  }

  gt(column, value) {
    this.filters.push({ type: 'gt', column, value })
    return this
  }

  lt(column, value) {
    this.filters.push({ type: 'lt', column, value })
    return this
  }

  is(column, value) {
    this.filters.push({ type: 'is', column, value })
    return this
  }

  in(column, value) {
    this.filters.push({ type: 'in', column, value })
    return this
  }

  order(column, { ascending = true } = {}) {
    this.orderBy = { column, ascending }
    return this
  }

  range(from, to) {
    this.rangeBounds = { from, to }
    return this
  }

  limit(count) {
    const upper = Math.max(0, count - 1)
    this.rangeBounds = { from: 0, to: upper }
    return this
  }

  async execute() {
    const store = this.store
    const rows = store[this.table] || []
    const now = new Date().toISOString()

    if (this.action === 'insert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload]
      const inserted = payloads.map((item) => {
        const row = {
          ...item,
          id: item.id || createId(store, this.table),
          created_at: item.created_at || now,
          updated_at: item.updated_at || now,
        }
        rows.push(row)
        return row
      })
      return { data: inserted, error: null }
    }

    if (this.action === 'upsert') {
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload]
      const updated = payloads.map((item) => {
        const existingIndex = rows.findIndex((row) => row.id === item.id)
        if (existingIndex >= 0) {
          rows[existingIndex] = { ...rows[existingIndex], ...item }
          return rows[existingIndex]
        }
        const row = {
          ...item,
          id: item.id || createId(store, this.table),
          created_at: item.created_at || now,
          updated_at: item.updated_at || now,
        }
        rows.push(row)
        return row
      })
      return { data: updated, error: null }
    }

    if (this.action === 'update') {
      const matches = applyFilters(rows, this.filters, store)
      matches.forEach((row) => Object.assign(row, this.payload, { updated_at: now }))
      return { data: matches, error: null }
    }

    if (this.action === 'delete') {
      const matches = applyFilters(rows, this.filters, store)
      const ids = new Set(matches.map((row) => row.id))
      store[this.table] = rows.filter((row) => !ids.has(row.id))
      return { data: matches, error: null }
    }

    let filtered = applyFilters(rows, this.filters, store)

    if (this.orderBy) {
      const { column, ascending } = this.orderBy
      filtered = [...filtered].sort((a, b) => {
        if (a[column] === b[column]) return 0
        if (a[column] === undefined) return 1
        if (b[column] === undefined) return -1
        return ascending ? (a[column] > b[column] ? 1 : -1) : (a[column] < b[column] ? 1 : -1)
      })
    }

    if (this.selectOptions?.count && this.selectOptions?.head) {
      return { data: null, error: null, count: filtered.length }
    }

    if (this.rangeBounds) {
      const { from, to } = this.rangeBounds
      filtered = filtered.slice(from, to + 1)
    }

    return { data: filtered, error: null }
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject)
  }

  async maybeSingle() {
    const result = await this.execute()
    const row = Array.isArray(result.data) ? result.data[0] : result.data
    return { data: row || null, error: null }
  }

  async single() {
    const result = await this.execute()
    const row = Array.isArray(result.data) ? result.data[0] : result.data
    if (!row) {
      return { data: null, error: { message: 'No rows' } }
    }
    return { data: row, error: null }
  }
}

const createMockSupabase = () => {
  const store = seedStore()
  return {
    from: (table) => new MockQuery(table, store),
    _store: store,
  }
}

vi.mock('../src/db/supabase.js', () => ({
  getSupabaseAdmin: () => mockSupabase,
  handleSupabaseError: (res, _error, message = 'Database error') =>
    res.status(500).json({ error: { code: 'database_error', message } }),
}))

vi.mock('../src/auth/supabaseAuth.js', () => ({
  requireSupabaseAuth: (req, _res, next) => {
    req.auth = {
      userId: 'user_1',
      email: 'alex@teampad.io',
      role: 'authenticated',
      userMetadata: { full_name: 'Alex Johnson' },
      appMetadata: {},
    }
    return next()
  },
  verifySupabaseToken: async () => ({
    sub: 'user_1',
    email: 'alex@teampad.io',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 3600,
    user_metadata: { full_name: 'Alex Johnson' },
    app_metadata: {},
  }),
  createAuthToken: async () => 'test-token',
  buildAuthCookieOptions: () => ({ httpOnly: true, path: '/' }),
  getAuthTokenTtlSeconds: () => 3600,
  getAuthCookieName: () => 'teampad_session',
}))

vi.mock('../src/utils/email.js', () => ({
  sendWorkspaceInviteEmail: async () => ({ sent: false, reason: 'test' }),
  sendPasswordResetEmail: async () => ({ sent: true, messageId: 'test' }),
  sendSignupOtpEmail: async () => ({ sent: true, messageId: 'test' }),
}))

vi.mock('express-rate-limit', () => ({
  default: () => (_req, _res, next) => next(),
}))

beforeAll(async () => {
  const appModule = await import('../src/app.js')
  app = appModule.app
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }
})

const api = () => request(baseUrl)

describe('API smoke tests', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase()
  })

  it('creates a session and sets an auth cookie', async () => {
    const res = await api()
      .post('/v1/auth/login')
      .send({ email: 'alex@teampad.io', password: 'password123' })
      .expect(200)

    expect(res.body.data?.userId).toBe('user_1')
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('requests a signup OTP', async () => {
    const res = await api()
      .post('/v1/auth/signup/request')
      .send({ email: 'new@teampad.io' })
      .expect(200)

    expect(res.body.data?.sent).toBe(true)
    expect(mockSupabase._store.signup_otps.length).toBe(1)
  })

  it('rejects signup OTP requests within cooldown', async () => {
    mockSupabase._store.signup_otps.push({
      id: 'otp_1',
      email: 'cooldown@teampad.io',
      code: '123456',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })

    const res = await api()
      .post('/v1/auth/signup/request')
      .send({ email: 'cooldown@teampad.io' })

    expect(res.status).toBe(429)
  })

  it('verifies a signup OTP and creates a user', async () => {
    mockSupabase._store.signup_otps.push({
      id: 'otp_2',
      email: 'fresh@teampad.io',
      code: '654321',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    })

    const res = await api()
      .post('/v1/auth/signup/verify')
      .send({ name: 'Fresh User', email: 'fresh@teampad.io', password: 'password123', code: '654321' })
      .expect(200)

    expect(res.body.data?.email).toBe('fresh@teampad.io')
    const createdUser = mockSupabase._store.users.find((row) => row.email === 'fresh@teampad.io')
    expect(createdUser).toBeTruthy()
    expect(mockSupabase._store.signup_otps.find((row) => row.email === 'fresh@teampad.io')).toBeUndefined()
  })

  it('creates a note in a workspace', async () => {
    const res = await api()
      .post('/v1/workspaces/ws_1/notes')
      .send({ groupId: 'grp_1', title: 'Hello', body: 'World', tags: ['alpha'] })
      .expect(201)

    expect(res.body.data?.workspaceId).toBe('ws_1')
    expect(res.body.data?.groupId).toBe('grp_1')
    expect(res.body.data?.title).toBe('Hello')
  })

  it('creates a workspace invite', async () => {
    const res = await api()
      .post('/v1/workspaces/ws_1/invites')
      .send({ email: 'new@teampad.io', role: 'member' })
      .expect(201)

    expect(res.body.data?.workspaceId).toBe('ws_1')
    expect(res.body.data?.email).toBe('new@teampad.io')
  })

  it('creates a group in a workspace', async () => {
    const res = await api()
      .post('/v1/workspaces/ws_1/groups')
      .send({ name: 'Design', color: '#111111' })
      .expect(201)

    expect(res.body.data?.workspaceId).toBe('ws_1')
    expect(res.body.data?.name).toBe('Design')
  })

  it('accepts a workspace invite', async () => {
    const store = mockSupabase._store
    store.workspace_invites.push({
      id: 'inv_1',
      workspace_id: 'ws_1',
      email: 'alex@teampad.io',
      role: 'member',
      token: 'token_accept',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_by: 'user_1',
      created_at: new Date().toISOString(),
    })

    const res = await api().post('/v1/invites/token_accept/accept').expect(200)

    expect(res.body.data?.workspaceId).toBe('ws_1')
    expect(res.body.data?.member?.role).toBe('member')
    expect(store.workspace_invites.length).toBe(0)
  })

  it('declines a workspace invite', async () => {
    const store = mockSupabase._store
    store.workspace_invites.push({
      id: 'inv_2',
      workspace_id: 'ws_1',
      email: 'alex@teampad.io',
      role: 'member',
      token: 'token_decline',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_by: 'user_1',
      created_at: new Date().toISOString(),
    })

    const res = await api().post('/v1/invites/token_decline/decline').expect(200)

    expect(res.body.data?.workspaceId).toBe('ws_1')
    expect(res.body.data?.email).toBe('alex@teampad.io')
    expect(store.workspace_invites.length).toBe(0)
  })

  it('removes a workspace member', async () => {
    const store = mockSupabase._store
    store.workspace_members.push({
      id: 'wm_2',
      workspace_id: 'ws_1',
      user_id: 'user_2',
      role: 'member',
      created_at: new Date().toISOString(),
    })

    const res = await api().delete('/v1/workspaces/ws_1/members/user_2').expect(200)

    expect(res.body.data?.workspaceId).toBe('ws_1')
    expect(res.body.data?.userId).toBe('user_2')
    expect(store.workspace_members.find((row) => row.user_id === 'user_2')).toBeUndefined()
  })

  it('blocks free plan from creating more than 5 collections', async () => {
    const store = mockSupabase._store
    store.groups.push(
      { id: 'grp_2', workspace_id: 'ws_1', name: 'A', color: '#111111', created_at: new Date().toISOString() },
      { id: 'grp_3', workspace_id: 'ws_1', name: 'B', color: '#111111', created_at: new Date().toISOString() },
      { id: 'grp_4', workspace_id: 'ws_1', name: 'C', color: '#111111', created_at: new Date().toISOString() },
      { id: 'grp_5', workspace_id: 'ws_1', name: 'D', color: '#111111', created_at: new Date().toISOString() },
    )

    const res = await api()
      .post('/v1/workspaces/ws_1/groups')
      .send({ name: 'Overflow', color: '#111111' })
      .expect(403)

    expect(res.body.error?.code).toBe('limit_reached')
  })

  it('blocks free plan from creating more than 8 notes in a collection', async () => {
    const store = mockSupabase._store
    for (let i = 0; i < 8; i += 1) {
      store.notes.push({
        id: `note_${i + 1}`,
        workspace_id: 'ws_1',
        group_id: 'grp_1',
        title: `Note ${i + 1}`,
        body: 'Body',
        tags: [],
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        updated_by_id: 'user_1',
      })
    }

    const res = await api()
      .post('/v1/workspaces/ws_1/notes')
      .send({ groupId: 'grp_1', title: 'Overflow', body: 'Body', tags: [] })
      .expect(403)

    expect(res.body.error?.code).toBe('limit_reached')
  })

  it('records upgrade intent and returns pending status', async () => {
    const first = await api().post('/v1/upgrade-intents').send({ plan: 'premium', source: 'pricing' }).expect(201)
    expect(first.body.data?.plan).toBe('premium')
    expect(first.body.data?.alreadyPending).toBe(false)

    const second = await api().post('/v1/upgrade-intents').send({ plan: 'premium', source: 'pricing' }).expect(200)
    expect(second.body.data?.alreadyPending).toBe(true)
  })
})
