# TeamPad (Frontend)

TeamPad is the calm, fast workspace for teams to capture knowledge, stay aligned, and ship together.

We will perform the best of the best.

## This folder
This is the frontend app. The API server lives in `../server`.

## Run locally
```sh
npm install
npm run dev
```

Frontend runs on http://localhost:8080

## Environment (`teampad/.env`)
```
VITE_API_MODE=live
VITE_API_URL=http://localhost:4000/v1
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
VITE_ABLY_KEY=...
VITE_SHOW_PLAN_DEBUG=false
```

For the full system overview, see the repo root `readme.md` and `PRODUCT_DESIGN.md`.
