# Beacon Operations

Internal operations app for Beacon: projects, work items, purchasing and site tasks,
with read-only portals for clients and consultants.

- **Stack:** Next.js, Supabase (Postgres, auth, row-level security), files in Google Drive.
- **Database:** `supabase/migrations/`. Roles are enforced in the database:
  management (everything), site ops (work items, site tasks, purchase requests),
  procurement (purchases, suppliers), accountant (payment details only),
  client / consultant (read-only, their own projects, client-visible items only).
- **Currency:** EGP by default.
