TeamPad Production Runbook
=========================

Purpose
-------
This document is the post-deploy runbook for TeamPad (server + web + mobile).
It lists required environment variables, deployment steps, verification checks,
and the minimum improvements to keep the app stable in production.


Contents
--------
1) Production Environment Checklist
2) Required Environment Variables
3) Deploy Steps (Server + Web + Mobile)
4) Post-Deploy Verification
5) Monitoring + Alerts
6) Rollback Plan
7) Security + Compliance
8) Performance Hardening


1) Production Environment Checklist
-----------------------------------
- Secrets are set in the deployment platform (never in git).
- Cookies configured for cross-site: SameSite=None + Secure=true.
- CORS origin points to the deployed web app.
- Supabase URL and service role key reachable from the server.
- Ably configured (key or auth endpoint).
- SMTP tested (password reset + OTP).
- Database migrations applied.
- Rate limits adjusted (only auth endpoints limited).
- Health check and error logging enabled.


2) Required Environment Variables
---------------------------------
Server (server/.env in production platform):
- NODE_ENV=production
- APP_URL=https://<your-web-app-domain>
- CORS_ORIGIN=https://<your-web-app-domain>
- AUTH_JWT_SECRET=<long random secret>
- CSRF_SECRET=<long random secret>
- AUTH_COOKIE_NAME=teampad_session
- AUTH_COOKIE_SAMESITE=none
- AUTH_COOKIE_SECURE=true
- SUPABASE_URL=https://<your-project>.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
- ABLY_API_KEY=<ably-key> (required for realtime publish + token auth)
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
- AUTH_JWT_TTL_SECONDS=604800 (7 days) or desired session duration
- CSRF_TOKEN_TTL_SECONDS=3600 (or desired CSRF TTL)

Web (teampad/.env in production platform):
- VITE_API_URL=https://<your-api-domain>/api
- VITE_ABLY_AUTH_URL=https://<your-api-domain>/api/ably/auth (recommended)
- VITE_ABLY_CHAT=true
- VITE_SHOW_PLAN_DEBUG=false

Mobile (teampad-mobile/.env or Expo secrets):
- EXPO_PUBLIC_API_URL=https://<your-api-domain>/api
- EXPO_PUBLIC_LOW_END_PROFILE=false
- EXPO_PUBLIC_PERF_OVERLAY=false

Notes:
- If web and server are on different domains, SameSite must be "none" and
  AUTH_COOKIE_SECURE must be true, or cookies will not be sent.
- Do not ship .env files; use deployment secrets.


3) Deploy Steps (Server + Web)
------------------------------
Server:
1. Apply database migrations (Supabase SQL) in order.
2. Set production env vars in the server host (Vercel, Render, etc).
3. Deploy server build.
4. Confirm server health endpoints respond.

Web:
1. Set production env vars in the web host.
2. Build the web app.
3. Deploy static assets.

Mobile (Expo):
1. Set Expo secrets for `EXPO_PUBLIC_API_URL`.
2. Build release via EAS or your chosen pipeline.
3. Confirm login + chat realtime on a physical device.

Required migrations (newest last):
- server/docs/migrations/20260101_fix_profiles_fk.sql
- server/docs/migrations/20260110_add_custom_users_auth.sql
- server/docs/migrations/20260111_skip_default_note_if_existing_workspace.sql
- server/docs/migrations/20260112_add_workspace_chat.sql
- server/docs/migrations/20260113_chat_policies_and_moderation.sql
- server/docs/migrations/20260115_add_last_workspace_to_profiles.sql
- server/docs/migrations/20260115_chat_retention_by_plan.sql


4) Post-Deploy Verification
---------------------------
Run these checks after deployment:

Auth:
- Sign up, verify OTP, log in, log out.
- Wait 15 minutes and confirm session is still valid.
- Confirm /api/auth/refresh returns 200 and cookies update.

Notes:
- Create note, open note, edit note, confirm updates persist.
- Note list shows previews, editor loads full body.

Chat:
- Send message, see realtime update.
- Open workspace on another device, confirm messages sync.
- Mentions update unread count.

Invites:
- Send invite, accept invite, verify membership.

Uploads:
- Upload an image in chat, verify retrieval and permissions.

Load-time checks (quick smoke):
- Create note, open note, confirm editor loads body quickly.
- Send chat message, confirm it appears in history fast.
- Accept an invite link, confirm membership and access.

5-minute smoke test script
--------------------------
Goal: verify core flows work end-to-end in under 5 minutes.

1) Auth
- Sign in with a test account.
- Open `/app` and confirm dashboard loads without errors.

2) Notes
- Create a note titled "Smoke Test".
- Click the note; confirm body loads in the editor within a few seconds.
- Type a short line, wait for save indicator.

3) Chat
- Open chat.
- Send "smoke test" message.
- Confirm it appears immediately in history and on a second device/tab.

4) Invite
- Send an invite to a secondary email.
- Accept invite in another browser/profile.
- Confirm access to the same workspace and notes.

5) Logout
- Log out and confirm you are redirected to `/auth`.

Error handling:
- Turn off network, confirm "offline" message.
- Ably auth failure -> realtime marked unavailable.


5) Monitoring + Alerts
----------------------
Minimum monitoring for production:
- Error logging: server errors, auth failures, Supabase failures.
- Ably status logs (auth failures, connection state changes).
- Rate limit metrics for auth endpoints.
- 4xx/5xx metrics and response time.

Recommended alerts:
- Error rate > 2% for 5 minutes.
- Auth refresh failure spikes.
- Ably auth 401/403 spikes.
- Supabase fetch failures.


6) Rollback Plan
----------------
If deployment fails:
1. Roll back web assets to previous build.
2. Roll back server to previous release.
3. If a migration caused breakage, revert with a new migration (do not delete).
4. Verify auth and chat after rollback.


7) Security + Compliance
------------------------
- Rotate JWT + CSRF secrets after any leak.
- Rotate SMTP credentials every 90 days.
- Remove .env from git and use secrets manager.
- Enable HTTPS-only cookies (Secure=true).
- Validate all inputs server-side (already enforced by DTO).


8) Performance Hardening
------------------------
- Keep note list lightweight (body preview only).
- Use pagination for notes and chat.
- Avoid repeated refresh loops on 401 (single retry).
- Cache user profile + workspace metadata where safe.
- Use Ably token auth (not direct key) in production.
- Prefer cached render + background refresh on mobile.
