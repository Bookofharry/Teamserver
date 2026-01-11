# TeamPad Performance Checklist

Goal: "lightweight and silk" UI/UX. Use this checklist to keep payloads small, renders calm, and interactions fast.

## 1) Baseline (measure first)
- Network: note the slowest endpoints and biggest JSON responses.
- UI: use React Profiler to find components with heavy re-renders.
- Record: initial load time, note list load time, chat send delay.

## 2) Payloads (small responses)
- List endpoints must NOT include heavy fields (no full note bodies).
- Paginate or "load more" for large lists.
- Add hard request body size limits on the server.
- Avoid sending large JSON when a smaller response works.

## 3) Rendering (avoid extra work)
- Memoize list items and expensive components.
- Keep state updates scoped (no setState loops).
- Avoid passing new objects/arrays inline when not needed.
- Split big screens into smaller components.

## 4) Interaction speed (feel fast)
- Use optimistic UI for chat + quick actions.
- Add skeletons and clear loading states.
- Debounce search and heavy filters.

## 5) Data fetching (be smart)
- Cache with React Query.
- Avoid refetching on every tiny change.
- Use polling only when needed.
- Cancel stale requests on route change.

## 6) Error handling (fail fast)
- Return clear errors for oversized payloads.
- Avoid "silent errors" that keep retrying.
- Rate limits only on login/logout and abuse-prone endpoints.

## 7) Mobile performance
- Avoid giant reflows; keep containers stable.
- Use smaller text and layout on small screens.
- Ensure scroll containers are not blocked by overlays.

## 8) Verify improvements
- Re-measure after each change.
- Track: response size, render time, user-visible lag.
- Keep a short changelog of perf wins.

## Quick Wins (start here)
- Keep note list payloads small.
- Limit request body size.
- Optimize chat rendering and optimistic updates.
- Fix update loops in hooks.

## When speed still feels slow
- Inspect payload size in Network tab.
- Check React Profiler for re-render hot spots.
- Add a small server-side cache for frequent reads.

## Ownership
Every new feature should pass:
- Payload check
- Render check
- Interaction check

