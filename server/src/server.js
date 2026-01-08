import { app } from './app.js'
import { verifyGeminiConfigured } from './startupChecks.js'
import logger from './utils/logger.js'

const port = Number(process.env.PORT) || 3000

try {
  verifyGeminiConfigured()
} catch (err) {
  logger.error({ err }, 'Startup validation failed')
  process.exit(1)
}

app.listen(port, () => {
  logger.info({ port }, 'Server listening')
})
