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

  if (req.url && req.url.startsWith('/api/')) {
    req.url = req.url.replace(/^\/api/, '')
  }

  return app(req, res)
}
