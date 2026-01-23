# TeamPad — Current Build (Mobile-First)

Updated: 2026-01-23

## What’s Shipped (Mobile)
- Auth: signup/login/OTP/reset
- Workspaces: create/rename/delete, roles (owner/admin/member)
- Collections (groups): create + select via dropdown
- Notes: create/edit/pin/search, quick previews
- Chat: realtime updates, reactions, typing indicator
- Invites: send/accept/decline + member list
- Profile + Settings
- Branded loading and empty states

## Performance & UX
- Prefetch on intent (press-in)
- In-memory cache with stale-while-revalidate
- Skeletons for empty cache (Workspaces/Notes/Chat)
- Fast navigation transitions
- Safe-area spacing on FABs and input bars

## What’s Not Shipped Yet
- AI assistant UI
- Voice notes
- Focus mode
- Team pulse
- Billing / subscriptions
- Public notes

## Realtime
- Ably token auth via `/api/ably/auth`
- Server publishes message + reaction events

## Mobile Env (Expo)
```
EXPO_PUBLIC_API_URL=https://<your-api-domain>/api
EXPO_PUBLIC_LOW_END_PROFILE=false
EXPO_PUBLIC_PERF_OVERLAY=false
```
