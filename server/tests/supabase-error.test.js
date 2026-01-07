import { describe, it, expect, vi } from 'vitest'
import { handleSupabaseError } from '../src/db/supabase.js'
import logger from '../src/utils/logger.js'

// Mock a simple express res-like object
function makeRes() {
  let statusCode = null
  let body = null
  return {
    status(code) {
      statusCode = code
      return this
    },
    json(obj) {
      body = obj
      return { statusCode, body }
    },
    _get() {
      return { statusCode, body }
    },
  }
}

describe('handleSupabaseError', () => {
  it('logs serialized supabase error and returns 500 without leaking details', () => {
    const res = makeRes()
    const err = { message: 'boom', code: 'bad', details: 'constraint failed' }
    const spy = vi.spyOn(logger, 'error').mockImplementation(() => {})

    const out = handleSupabaseError(res, err, 'custom message')
    expect(spy).toHaveBeenCalled()
    const callArg = spy.mock.calls[0][0]
    expect(callArg.supabase).toBeDefined()
    expect(callArg.supabase.message).toBe('boom')
    expect(out.body.error.message).toBe('custom message')
    spy.mockRestore()
  })
})