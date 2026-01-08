import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { apiRouter } from './routes/api.js'
import logger from './utils/logger.js'
import { csrfMiddleware } from './middleware/csrf.js'
import requestIdMiddleware from './middleware/requestId.js'

const app = express()

const defaultOrigins = ['http://localhost:8080']
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : defaultOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())
app.use(requestIdMiddleware)
app.use(csrfMiddleware)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})
app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'TeamPad API is live' })
})
app.use('/v1', apiRouter)
app.use((err, req, res, next) => {
  const log = (req && req.log) || logger
  log.error({ err, requestId: req?.requestId }, 'Unhandled error')
  res.status(500).json({ error: { code: 'server_error', message: 'Unexpected server error' } })
})

export { app }
