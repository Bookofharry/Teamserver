import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { verifyGeminiConfigured } from '../src/startupChecks.js'

const OLD_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...OLD_ENV }
})

describe('startupChecks', () => {
  it('no-op when AI_PROVIDER is not gemini', () => {
    process.env.AI_PROVIDER = 'mock'
    process.env.NODE_ENV = 'production'
    expect(() => verifyGeminiConfigured()).not.toThrow()
  })

  it('throws when gemini selected and credentials missing in production', () => {
    process.env.AI_PROVIDER = 'gemini'
    process.env.NODE_ENV = 'production'
    delete process.env.GEMINI_API_URL
    delete process.env.GEMINI_API_KEY
    expect(() => verifyGeminiConfigured()).toThrow(/GEMINI_API_URL and GEMINI_API_KEY/)
  })

  it('does not throw when gemini selected and credentials present in production', () => {
    process.env.AI_PROVIDER = 'gemini'
    process.env.NODE_ENV = 'production'
    process.env.GEMINI_API_URL = 'https://api.gemini.test'
    process.env.GEMINI_API_KEY = 'test-key'
    expect(() => verifyGeminiConfigured()).not.toThrow()
  })

  it('does not throw in development even when creds missing', () => {
    process.env.AI_PROVIDER = 'gemini'
    process.env.NODE_ENV = 'development'
    delete process.env.GEMINI_API_URL
    delete process.env.GEMINI_API_KEY
    expect(() => verifyGeminiConfigured()).not.toThrow()
  })
})
