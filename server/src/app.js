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
app.use(express.json())
app.use(requestIdMiddleware)
app.use(csrfMiddleware)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TeamPad API</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0f1a;
        --panel: rgba(12, 18, 32, 0.7);
        --text: #e6f0ff;
        --muted: #9bb0d3;
        --accent: #31d0ff;
        --accent-2: #7b5bff;
        --glow: rgba(49, 208, 255, 0.35);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(1000px 600px at 20% 10%, #1a2442 0%, transparent 70%),
          radial-gradient(900px 500px at 80% 20%, #221a4f 0%, transparent 70%),
          linear-gradient(180deg, #060912 0%, #0b0f1a 100%);
        color: var(--text);
        font-family: "Satoshi", "Space Grotesk", "Segoe UI", system-ui, sans-serif;
        display: grid;
        place-items: center;
        padding: 32px;
      }
      .card {
        width: min(880px, 92vw);
        padding: 48px;
        border-radius: 24px;
        background: var(--panel);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(12px);
        position: relative;
        overflow: hidden;
      }
      .card::before {
        content: "";
        position: absolute;
        inset: -2px;
        border-radius: 24px;
        padding: 2px;
        background: linear-gradient(120deg, transparent, var(--accent), transparent);
        mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        mask-composite: exclude;
        opacity: 0.7;
        pointer-events: none;
      }
      .badge {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--accent);
        border: 1px solid rgba(49, 208, 255, 0.35);
        background: rgba(49, 208, 255, 0.08);
      }
      h1 {
        margin: 18px 0 12px;
        font-size: clamp(28px, 4vw, 42px);
        letter-spacing: -0.02em;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: clamp(14px, 1.5vw, 18px);
        line-height: 1.6;
      }
      .routes {
        margin-top: 28px;
        display: grid;
        gap: 12px;
      }
      .route {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 18px;
        border-radius: 14px;
        background: rgba(10, 18, 34, 0.6);
        border: 1px solid rgba(123, 91, 255, 0.18);
      }
      .route span {
        font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        color: #cfe1ff;
      }
      .route em {
        font-style: normal;
        color: var(--accent);
        text-shadow: 0 0 20px var(--glow);
      }
      .glow {
        position: absolute;
        width: 320px;
        height: 320px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(49, 208, 255, 0.25) 0%, transparent 70%);
        filter: blur(6px);
        right: -100px;
        top: -80px;
        opacity: 0.6;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="glow"></div>
      <span class="badge">Live API</span>
      <h1>Welcome — this is the live API of TeamPad.</h1>
      <p>
        You are connected to the production gateway powering TeamPad workspaces, notes,
        and invites. Use the routes below to verify availability.
      </p>
      <div class="routes">
        <div class="route">
          <span>/health</span>
          <em>status: ok</em>
        </div>
        <div class="route">
          <span>/v1/...</span>
          <em>API namespace</em>
        </div>
      </div>
    </div>
  </body>
</html>`)
})
app.use('/v1', apiRouter)
app.use((err, req, res, next) => {
  const log = (req && req.log) || logger
  log.error({ err, requestId: req?.requestId }, 'Unhandled error')
  res.status(500).json({ error: { code: 'server_error', message: 'Unexpected server error' } })
})

export { app }
