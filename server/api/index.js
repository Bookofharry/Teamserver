import { app } from '../src/app.js'
import { verifyGeminiConfigured } from '../src/startupChecks.js'
import logger from '../src/utils/logger.js'

let didVerify = false

const ensureStartupChecks = () => {
  if (didVerify) return
  try {
    verifyGeminiConfigured()
    didVerify = true
  } catch (err) {
    logger.error({ err }, 'Startup validation failed')
    throw err
  }
}

export default function handler(req, res) {
  try {
    ensureStartupChecks()
  } catch (err) {
    return res
      .status(500)
      .json({ error: { code: 'server_error', message: 'Server misconfigured' } })
  }

  if (req.url) {
    const url = new URL(req.url, 'http://localhost')
    const path = url.searchParams.get('path')
    if (path) {
      req.url = `/api/${path.replace(/^\/+/, '')}`
    }
  }

  return app(req, res)
}
