import { app } from './app.js'
import { verifyGeminiConfigured, verifySupabaseReachable } from './startupChecks.js'
import { getSupabaseAdmin } from './db/supabase.js'
import logger from './utils/logger.js'

const port = Number(process.env.PORT) || 3000

const startServer = async () => {
  try {
    verifyGeminiConfigured()
    await verifySupabaseReachable(getSupabaseAdmin())
  } catch (err) {
    logger.error({ err }, 'Startup validation failed')
    process.exit(1)
  }

  app.listen(port, () => {
    logger.info({ port }, 'Server listening')
  })
}

startServer()
