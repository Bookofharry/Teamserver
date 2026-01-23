# TeamPad

TeamPad is the calm, fast workspace for teams to capture knowledge, stay aligned, and ship together.

We will perform the best of the best.

## What it is
- A calm, fast workspace for teams to capture knowledge and chat in one place.
- Mobile-first UX with realtime updates and no blank states.

## Key capabilities (current build)
- Email/password auth with OTP verification.
- Workspace roles (owner, admin, member).
- Notes: create/edit, pinning, search, quick previews.
- Workspace chat with realtime updates + reactions.
- Invites (send, accept, decline) and member list.
- Onboarding, profile, settings, and branded loading states.

## Tech stack
- Web: React + Vite + TypeScript + Tailwind + shadcn/ui
- Mobile: React Native (Expo) + TypeScript
- Backend: Node.js + Express
- Data: Supabase Postgres + Storage
- Realtime: Ably
- Email: SMTP (Nodemailer)
- AI (server-only, optional/experimental): Gemini

## Repo structure
```
teampad/   # Frontend app
teampad-mobile/   # Mobile app (Expo)
server/    # API server
```

## Current state + roadmap
- Current build: see `CURRENT_STATE.md`
- Roadmap: see `ROADMAP.md`

## Quick start
Install dependencies:

```sh
cd server
npm install

cd ../teampad
npm install
```

Run dev servers:

```sh
cd server
npm run dev
```

```sh
cd teampad
npm run dev
```

- Mobile (Expo):
```sh
cd teampad-mobile
npm install
npm run start
```

- Frontend: http://localhost:8080
- API: http://localhost:4000/api

## Environment variables

### Frontend (`teampad/.env`)
```
VITE_API_MODE=live
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
VITE_ABLY_KEY=...               # Optional for local dev
VITE_ABLY_AUTH_URL=...          # Optional override for Ably auth endpoint
VITE_ABLY_CHAT=true             # Use Ably Chat rooms for realtime updates
VITE_SHOW_PLAN_DEBUG=false
```

### Mobile (`teampad-mobile/.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:4000/api
EXPO_PUBLIC_LOW_END_PROFILE=false
EXPO_PUBLIC_PERF_OVERLAY=false
```

### Server (`server/.env`)
```
PORT=4000
APP_URL=http://localhost:8080

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...          # HS256 tokens
SUPABASE_JWKS_URL=...            # RS/ES tokens
SUPABASE_JWKS_API_KEY=...        # Optional for JWKS requests

SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=TeamPad <noreply@yourdomain.com>

ABLY_API_KEY=...

AI_PROVIDER=mock                 # mock or gemini
GEMINI_API_URL=...
GEMINI_API_KEY=...
```

## Database and migrations
- Base schema: `server/docs/supabase-schema.sql`
- Incremental migrations: `server/docs/migrations/`

## Scripts
Server:
- `npm run dev`
- `npm start`
- `npm test`

Frontend:
- `npm run dev`
- `npm run build`
- `npm run preview`

## Testing
```sh
cd server
npm test
```

## Notes
- Keep secrets out of source control.
- Configure `workspace-chat` storage bucket and policies before enabling uploads.
- Mobile uses Bearer tokens (stored in SecureStore).
- Realtime uses Ably token auth via `/api/ably/auth`.

## Ably setup (first-time)
1) Create an Ably account + app at https://ably.com  
2) Copy the primary API key from the app dashboard  
3) Add it to `server/.env`:
```
ABLY_API_KEY=YOUR_ABLY_API_KEY
```
4) Enable realtime on the frontend (recommended):
```
VITE_ABLY_AUTH_URL=http://localhost:4000/api/ably/auth
```
5) Set `VITE_ABLY_CHAT=true` in `teampad/.env`.
6) Restart server + frontend, then open two browsers and send a message to confirm live updates.

### Server-side chat publish (optional)
For non-UI actions (admin tools, scripts), you can publish realtime chat events via:
```
POST /api/workspaces/:id/chat/events
```
This endpoint requires an admin user and accepts a JSON payload like:
```
{ "type": "message.created", "message": { ... } }
```
