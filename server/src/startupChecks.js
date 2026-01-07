import logger from './utils/logger.js'

export function verifyGeminiConfigured() {
  const provider = process.env.AI_PROVIDER || 'mock'
  if (provider !== 'gemini') return

  const isDev = (process.env.NODE_ENV || 'development') === 'development'
  const url = process.env.GEMINI_API_URL
  const key = process.env.GEMINI_API_KEY

  if (!isDev && (!url || !key)) {
    logger.error({ hasUrl: !!url, hasKey: !!key }, 'Gemini provider configured but credentials missing in non-development environment')
    throw new Error('GEMINI_API_URL and GEMINI_API_KEY must be set when AI_PROVIDER=gemini in non-development environments')
  }
}
