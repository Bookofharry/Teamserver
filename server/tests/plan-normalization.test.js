import request from 'supertest'
import { describe, it, expect, beforeEach, vi } from 'vitest'

let mockSupabase
let app

// reuse mock setup from api.test.js
const seedStore = () => {
  const now = new Date().toISOString()
  return {
    users: [
      {
        id: 'user_1',
        email: 'alex@teampad.io',
        password_hash: 'hash',
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
    workspaces: [{ id: 'ws_1', name: 'TeamPad', owner_id: 'user_1', created_at: now }],
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
  getAuthCookieName: () => 'teampad_session',
}))

vi.mock('../src/utils/email.js', () => ({
  sendWorkspaceInviteEmail: async () => ({ sent: false, reason: 'test' }),
  sendPasswordResetEmail: async () => ({ sent: false, reason: 'test' }),
}))

vi.mock('express-rate-limit', () => ({
  default: () => (_req, _res, next) => next(),
}))

const appModule = await import('../src/app.js')
app = appModule.app

const api = () => request(app)

describe('Plan normalization and limits', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase()
  })

  it('allows publishing notes when profile.plan is "premium+" (non-normalized)', async () => {
    const store = mockSupabase._store
    store.profiles[0].plan = 'premium+'

    // seed a note
    store.notes.push({
      id: 'note_1',
      workspace_id: 'ws_1',
      group_id: 'grp_1',
      title: 'Note',
      body: 'Body',
      updated_by_id: 'user_1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const res = await api().patch('/v1/notes/note_1/public').send({ isPublic: true }).expect(200)
    expect(res.body.data?.isPublic ?? res.body.data?.is_public).toBe(true)
  })

  it('treats "premium+" as superior to premium for group limits', async () => {
    const store = mockSupabase._store
    // create 20 existing groups
    for (let i = 0; i < 20; i++) {
      store.groups.push({ id: `grp_extra_${i}`, workspace_id: 'ws_1', name: `G${i}`, color: '#000000', created_at: new Date().toISOString() })
    }

    // with premium plan, creating a group should be blocked
    store.profiles[0].plan = 'premium'
    await api().post('/v1/workspaces/ws_1/groups').send({ name: 'Too Many' }).expect(403)

    // with premium+ plan (non-normalized), creating should be allowed
    store.profiles[0].plan = 'premium+'
    await api().post('/v1/workspaces/ws_1/groups').send({ name: 'Allowed' }).expect(201)
  })
})
