import 'dotenv/config'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { apiRouter } from './routes/api.js'
import logger from './utils/logger.js'
import requestIdMiddleware from './middleware/requestId.js'

const app = express()

app.set('trust proxy', true)


const corsBaseOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  exposedHeaders: [],
}

// Security: In production, we should restrict the origin.
// If CORS_ORIGIN is set, use it. Otherwise, default to true (allow all) for flexibility.
const origin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true
app.use(cors({ ...corsBaseOptions, origin }))
app.options(/.*/, cors({ ...corsBaseOptions, origin }))
const bodyLimit = process.env.REQUEST_BODY_LIMIT || '2mb'

app.use(express.json({ limit: bodyLimit }))
app.use(express.urlencoded({ extended: true, limit: bodyLimit }))
app.use(cookieParser())
app.use(requestIdMiddleware)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})
app.get('/', (req, res) => {
  res.json({
    message: 'TeamPad API',
    status: 'success',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  })
})
app.use('/api', apiRouter)
app.use('/v1', apiRouter)

app.use((err, req, res, next) => {
  const log = (req && req.log) || logger
  log.error({ err, requestId: req?.requestId }, 'Unhandled error')
  if (res.headersSent) return
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return res.status(413).json({
      error: { code: 'payload_too_large', message: 'Payload too large. Please reduce the size and try again.' },
    })
  }
  res.status(500).json({ error: { code: 'server_error', message: 'Unexpected server error' } })
})
app.use((req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } })
})

export { app }
