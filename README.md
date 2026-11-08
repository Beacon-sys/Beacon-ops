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
