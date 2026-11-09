-- Beacon Operations: pages people create themselves (like Notion/Coda).
-- Pages nest inside other pages. Each page holds blocks: text, or a linked view
-- (table/board/calendar/list) of one of the app's databases, filtered as set on the block.

create table pages (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references pages(id) on delete cascade,
  title       text not null default 'Untitled',
  icon        text,
  position    int not null default 0,
  created_by  uuid references people(id) default (me()).id,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on pages (parent_id);

create table page_blocks (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references pages(id) on delete cascade,
  position    int not null default 0,
  kind        text not null check (kind in ('text','view')),
  title       text,
  body        text,                 -- text blocks
  source      text check (source in ('work_items','site_tasks','purchases','submittals','contracts','vendors')),
  project_id  uuid references projects(id) on delete set null,   -- view blocks: limit to one project
  settings    jsonb not null default '{}'::jsonb,                 -- view, group, filters, hidden fields
  created_at  timestamptz not null default now()
);
create index on page_blocks (page_id);

alter table pages       enable row level security;
alter table page_blocks enable row level security;

-- Internal staff read and build pages. Clients and consultants don't see them.
create policy pages_internal on pages       for all using (is_internal()) with check (is_internal());
create policy blocks_internal on page_blocks for all using (is_internal()) with check (is_internal());
