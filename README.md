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

## Languages (English / Arabic)

Everyone can switch between English and العربية from the bottom of the sidebar (or the
sign-in page). The choice is saved on their row in `people.language` (migration 0011)
and in a `lang` cookie; Arabic switches the whole layout to right-to-left.

- Interface text is written in English in the code and looked up in
  `src/lib/i18n/ar.ts`. Server components use `getT()` from `src/lib/i18n/server.ts`;
  client components use `useT()` or `<T>` from `src/components/i18n.tsx`. New text that
  isn't in `ar.ts` simply shows in English.
- Text people type (work item descriptions, categories, notes, site tasks, purchase
  requests, meeting and contract titles) is translated to Arabic by Claude
  (`src/lib/translate.ts`) the first time someone views it in Arabic, and stored in the
  `content_translations` table so it isn't translated again. Columns marked
  `translate: true` in `src/lib/db-columns.ts` are translated. Editing a cell always edits
  the original text.
- This needs an Anthropic API key as the Worker secret `ANTHROPIC_API_KEY`
  (Cloudflare dashboard → Workers & Pages → beacon-ops → Settings → Variables and Secrets →
  Add → type "Secret"). Without it the interface is still Arabic and typed text stays
  in its original language.
