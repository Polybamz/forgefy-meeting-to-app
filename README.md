# Forgefy — Meeting to App (Frontend)

TanStack Start (React 19 + Vite) frontend for Forgefy. Talks to the [forgefy-backend](../forgefy-backend) FastAPI/Firestore API for everything except Google sign-in (Firebase) and the public waitlist form (Supabase).

## Architecture

- **App data & auth**: [forgefy-backend](../forgefy-backend) (FastAPI + Firestore), reached via `/api/*` and `/ws/*`, proxied in dev by Vite and in production by Vercel rewrites (see `vercel.json`) to the Render-hosted API.
- **Google sign-in**: Firebase Auth (`src/lib/firebase.ts`) — only used to obtain a Google ID token, which is then exchanged with the backend at `POST /api/v1/auth/google`. Firebase does not store app data.
- **Waitlist form**: Supabase (`supabase/migrations/`) — a single `waitlist_signups` table with an insert-only RLS policy is provisioned, but no route/component in `src/` currently submits to it. Supabase is not used for anything else in this app; the auth-related files under `src/integrations/supabase/` are unused Lovable-generated scaffolding kept for reference.
- **Deployment**: Vercel (static SPA build + rewrites to the backend). There is no Cloudflare Workers deployment target — that config has been removed.

## Requirements

- Node.js 20+
- The [forgefy-backend](../forgefy-backend) API running locally (or a deployed instance) for anything beyond the static marketing pages
- A Firebase project with a Web App configured (for Google sign-in)
- A Supabase project (only needed if you're touching the waitlist form)

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API origin. Unset in dev (Vite proxies `/api` and `/ws` to `http://localhost:5000`); set to the deployed backend origin in production if not using the Vercel rewrite. |
| `VITE_FIREBASE_API_KEY` | Firebase Web App API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_SUPABASE_URL` | Supabase project URL (waitlist form only) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (waitlist form only) |

**Never commit `.env`.** It's gitignored — if you find it tracked or in `git log`, treat every value in it as compromised and rotate.

## Local Development

```bash
npm install
npm run dev
```

The dev server proxies `/api` and `/ws` to `http://localhost:5000` by default — run `forgefy-backend` locally on that port, or set `VITE_API_URL` to point elsewhere.

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build (`dist/client` + `dist/server`, prerenders static routes) |
| `npm run build:dev` | Development-mode build (unminified, for debugging build output) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |

## Deployment

Deployed on Vercel. `vercel.json` sets the build/output config and rewrites `/api/*` and `/ws/*` to the Render-hosted backend — update those rewrite targets if the backend's URL changes. No Cloudflare-specific setup is needed or used.

## Project Structure

```
src/
├── routes/                    # TanStack Router file-based routes
├── lib/
│   ├── api.ts                 # Backend API client (VITE_API_URL-based)
│   └── firebase.ts            # Firebase Auth (Google sign-in only)
├── integrations/supabase/     # Unused Lovable-generated scaffolding — not currently wired to any route
└── components/                # UI components (shadcn/radix-based)
supabase/migrations/           # Only migration: waitlist_signups table + RLS policy (provisioned, no submitting UI yet)
```
