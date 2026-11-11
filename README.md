# Beacon Operations

Internal operations app for Beacon: projects, work items, purchasing and site tasks,
with read-only portals for clients and consultants.

- **Stack:** Next.js, Supabase (Postgres, auth, row-level security), files in Google Drive.
- **Database:** `supabase/migrations/`. Roles are enforced in the database:
  management (everything), site ops (work items, site tasks, purchase requests),
  procurement (purchases, suppliers), accountant (payment details only),
  client / consultant (read-only, their own projects, client-visible items only).
- **Currency:** EGP by default.

## Running locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Database

Run each file in `supabase/migrations/` once, in order, in the Supabase SQL Editor.
People get access by being added on the People page (or in the `people` table) with
their email; when they sign up with that email their login is linked automatically.

## Hosting

Deployed on Cloudflare Workers (free plan) from the `main` branch with Workers Builds
(build command `npx opennextjs-cloudflare build`, deploy command `npx wrangler deploy`).
Config: `wrangler.jsonc`, `open-next.config.ts`. Netlify was tried first but its servers
time out from Egyptian networks.
In Supabase → Authentication → URL Configuration, the Site URL must be the app's URL.

## Ask Claude (in-app assistant)

Every signed-in person (except suppliers/contractors) gets an "Ask Claude" button at the
bottom corner. It answers questions by reading the database **as that person**, so Supabase
row-level security applies exactly as in the app: clients and consultants only see their own
projects and client-visible items. It is read-only and cannot change data.

Code: `src/lib/claude.ts` (shared Claude API client and model), `src/lib/assistant.ts`
(prompt, the `query_records` tool, tool loop), `src/app/api/assistant/route.ts`,
`src/components/assistant-panel.tsx`.

**Setup:** create an API key at https://console.anthropic.com (Settings → API keys; the
account needs credit). Then in the Cloudflare dashboard open Workers & Pages → `beacon-ops`
→ Settings → Variables and Secrets → Add, choose type **Secret**, name `ANTHROPIC_API_KEY`,
paste the key and deploy. Secrets survive later deploys from GitHub. Until the secret is set
the panel shows a "not switched on yet" note. For local development put
`ANTHROPIC_API_KEY=...` in `.env.local`.

Model: Claude Opus 5.5 (`claude-opus-5-5`). A typical question costs a few US cents; set a
monthly spend limit in the Anthropic Console (Settings → Limits) to cap it.
