import 'dotenv/config'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { apiRouter } from './routes/api.js'
import logger from './utils/logger.js'
import { csrfMiddleware } from './middleware/csrf.js'
import requestIdMiddleware from './middleware/requestId.js'

const app = express()

app.set('trust proxy', true)

const parseOrigins = (value = '') =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const uniqueOrigins = (origins) => Array.from(new Set(origins)).filter(Boolean)

const frontendOrigins = uniqueOrigins([
  ...parseOrigins(process.env.CORS_ORIGIN),
  ...parseOrigins(process.env.FRONTEND_URLS),
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.CLIENT_URL),
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
])

const corsBaseOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
}

const corsDelegate = (req, callback) => {
  const origin = req.header('Origin')
  if (!origin) {
    return callback(null, { ...corsBaseOptions, origin: true })
  }

  const isAllowed =
    frontendOrigins.includes(origin) || process.env.NODE_ENV === 'development'

  if (!isAllowed) {
    return callback(new Error('Not allowed by CORS'))
  }

  return callback(null, { ...corsBaseOptions, origin: true })
}

app.use(cors(corsDelegate))
app.options('*', cors(corsDelegate))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(requestIdMiddleware)
app.use(csrfMiddleware)

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
app.use((err, req, res, next) => {
  const log = (req && req.log) || logger
  log.error({ err, requestId: req?.requestId }, 'Unhandled error')
  res.status(500).json({ error: { code: 'server_error', message: 'Unexpected server error' } })
})
app.use((req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } })
})

export { app }
