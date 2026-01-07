import { app } from './app.js'
import logger from './utils/logger.js'
import { verifyGeminiConfigured } from './startupChecks.js'

// Run startup validations and fail fast in non-development environments
try {
  verifyGeminiConfigured()
} catch (err) {
  logger.error({ err }, 'Startup validation failed')
  // Exit with non-zero code to stop the process in production
  process.exit(1)
}

const port = process.env.PORT || 4000

app.listen(port, () => {
  logger.info({ port }, 'Server listening')
  logger.info({ url: `http://localhost:${port}/health` }, 'Health endpoint')
})
