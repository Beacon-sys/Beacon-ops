-- Beacon Operations: custom columns that management adds from the app.
-- Each column belongs to one database (work_items, site_tasks, purchases, submittals).
-- Values live in custom_values so clients only ever see columns marked client_visible.

create table custom_fields (
  id             uuid primary key default gen_random_uuid(),
  table_name     text not null check (table_name in ('work_items','site_tasks','purchases','submittals')),
  label          text not null,
  type           text not null default 'text'
                 check (type in ('text','longtext','number','money','date','select','checkbox','url')),
  options        text[] not null default '{}',     -- choices for "select"
  position       int not null default 0,
  client_visible boolean not null default false,  -- only matters for work_items
  created_at     timestamptz not null default now()
);

create table custom_values (
  field_id uuid not null references custom_fields(id) on delete cascade,
  row_id   uuid not null,
  value    text,
  primary key (field_id, row_id)
);
create index on custom_values (row_id);

alter table custom_fields enable row level security;
alter table custom_values enable row level security;

-- Column definitions: everyone signed in may read; only management changes them.
create policy cf_read  on custom_fields for select using (auth.uid() is not null);
create policy cf_mgmt  on custom_fields for all
  using (my_role()::text = 'management') with check (my_role()::text = 'management');

-- Values: internal staff read all. Clients and consultants read client-visible
-- work item columns on work items they can already see.
create policy cv_internal_read on custom_values for select using (is_internal());
create policy cv_external_read on custom_values for select using (
  exists (select 1 from custom_fields f where f.id = field_id and f.client_visible and f.table_name = 'work_items')
  and row_id in (select id from work_items));

-- Values are written by the roles that edit each database.
create function can_edit_custom(f uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select case (select table_name from custom_fields where id = f)
     when 'work_items' then my_role()::text in ('management','site_ops','tendering')
     when 'site_tasks' then my_role()::text in ('management','site_ops')
     when 'purchases'  then my_role()::text in ('management','procurement','accountant')
     when 'submittals' then my_role()::text in ('management','site_ops','tendering','procurement')
     else false end $$;

create policy cv_write  on custom_values for insert with check (can_edit_custom(field_id));
create policy cv_update on custom_values for update using (can_edit_custom(field_id)) with check (can_edit_custom(field_id));
create policy cv_delete on custom_values for delete using (can_edit_custom(field_id));

-- Remove values when their row is deleted.
create function custom_values_cleanup() returns trigger
  language plpgsql security definer set search_path = public as $$
begin delete from custom_values where row_id = old.id; return old; end $$;
create trigger custom_values_cleanup after delete on work_items  for each row execute function custom_values_cleanup();
create trigger custom_values_cleanup after delete on site_tasks  for each row execute function custom_values_cleanup();
create trigger custom_values_cleanup after delete on purchases   for each row execute function custom_values_cleanup();
create trigger custom_values_cleanup after delete on submittals  for each row execute function custom_values_cleanup();
