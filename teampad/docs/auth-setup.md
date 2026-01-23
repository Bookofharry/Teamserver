# Auth Setup (Custom JWT Cookies)

This project now uses a custom email/password auth flow with JWT session cookies.
Supabase is used for database only.

## Database Migration

Run:

```sql
server/docs/migrations/20260110_add_custom_users_auth.sql
```

This creates:
- `users` (email + password_hash)
- `password_reset_tokens`
- updates `profiles.id` to reference `users.id`

## Server Environment

Required:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_JWT_SECRET`
- `CSRF_SECRET`
- `APP_URL`
- `CORS_ORIGIN`
- `AUTH_COOKIE_NAME`
- `AUTH_COOKIE_SAMESITE`
- `AUTH_COOKIE_SECURE`

Optional:
- `AUTH_JWT_ISSUER` (default: `teampad`)
- `AUTH_JWT_AUDIENCE` (default: `teampad`)
- `AUTH_JWT_TTL_SECONDS` (default: 7 days)

Password reset email (optional, but recommended):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Auth Endpoints

Base URL: `/api`

- `POST /auth/signup/request` `{ email }`
- `POST /auth/signup/verify` `{ name, email, password, code }`
- `POST /auth/login` `{ email, password }`
- `POST /auth/logout`
- `POST /auth/forgot-password` `{ email }`
- `POST /auth/reset-password` `{ token, password }`
- `GET /me`

The server sets an HTTP-only cookie named `AUTH_COOKIE_NAME` on login/signup.

## Frontend Flow

- Login/Signup pages call the new endpoints.
- Auth state is derived from `/me`.
- Password reset uses email link with token.

## Mobile Flow
- Mobile uses Bearer tokens stored in SecureStore.
- Set `EXPO_PUBLIC_API_URL` to your `/api` base.
