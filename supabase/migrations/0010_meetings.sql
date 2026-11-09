-- Beacon Operations: meeting notes. Each action from a meeting is a site task
-- (site_tasks.meeting_id), so it shows with all other site tasks. site_tasks.party says
-- who has to act; client and consultant actions are visible to that client/consultant.

create table meetings (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  meeting_date  date not null default current_date,
  kind          text not null default 'progress'
                check (kind in ('progress','site','client','consultant','coordination','internal','other')),
  location      text,
  attendees     text,
  notes         text,
  created_by    uuid references people(id) default (me()).id,
  created_at    timestamptz not null default now()
);
create index on meetings (project_id);

alter table site_tasks
  add column meeting_id uuid references meetings(id) on delete set null,
  add column party text not null default 'beacon'
    check (party in ('beacon','client','consultant','contractor'));
create index on site_tasks (meeting_id);

-- When a task is assigned to someone, "who acts" follows that person's role.
create function site_tasks_party() returns trigger
  language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if new.assigned_to_id is not null and (tg_op = 'INSERT' or new.assigned_to_id is distinct from old.assigned_to_id) then
    select role::text into r from people where id = new.assigned_to_id;
    new.party := case when r in ('client','consultant','contractor') then r
                      when r = 'supplier' then 'contractor'
                      else 'beacon' end;
  end if;
  return new;
end $$;
create trigger site_tasks_party before insert or update on site_tasks
  for each row execute function site_tasks_party();

alter table meetings enable row level security;
create policy internal_read on meetings for select using (is_internal());
create policy meetings_write on meetings for all
  using (my_role()::text in ('management','site_ops','tendering'))
  with check (my_role()::text in ('management','site_ops','tendering'));

-- Clients and consultants see the actions they or the other external party own, on their projects.
create policy external_actions on site_tasks for select
  using (party in ('client','consultant') and project_id in (select external_project_ids()));

-- Pages can show meetings too (needs 0009 first).
alter table page_blocks drop constraint if exists page_blocks_source_check;
alter table page_blocks add constraint page_blocks_source_check
  check (source in ('work_items','site_tasks','purchases','submittals','contracts','vendors','meetings'));
