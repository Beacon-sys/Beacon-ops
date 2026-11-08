-- Beacon Operations: initial schema
-- Ported from the Coda "Beacon Operations Hub" (Projects, People & Companies,
-- Work Items, Purchasing, Site Tasks). Amounts default to EGP.

-- ─────────────────────────────── Types ───────────────────────────────
create type person_role as enum
  ('management','site_ops','procurement','accountant','client','consultant','supplier');

create type project_status as enum
  ('tendering','active','on_hold','handed_over','closed');

create type trade as enum
  ('civil','structural','architectural_finishes','mep_mechanical',
   'mep_electrical','mep_plumbing','landscape','general');

create type work_item_status as enum
  ('not_started','in_progress','awaiting_materials','awaiting_approval','done','on_hold');

create type purchase_status as enum
  ('requested','getting_quotes','approved','po_issued','delivered','rejected');

create type payment_status as enum
  ('not_invoiced','invoice_received','partly_paid','paid');

create type site_task_type as enum
  ('execution','inspection','snag','safety','survey','handover','other');

create type site_task_status as enum ('to_do','in_progress','blocked','done');

create type priority as enum ('high','medium','low');

-- ─────────────────────────────── Tables ──────────────────────────────
-- People & companies. user_id is set once the person has a login;
-- suppliers and contacts can exist without one.
create table people (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  name        text not null,
  email       text unique,
  phone       text,
  company     text,
  role        person_role not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table projects (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  code               text unique,
  client_id          uuid references people(id),
  consultant_id      uuid references people(id),
  project_manager_id uuid references people(id),
  location           text,
  status             project_status not null default 'tendering',
  start_date         date,
  planned_finish     date,
  contract_value     numeric(14,2),
  currency           char(3) not null default 'EGP',
  drive_folder_id    text,           -- Google Drive folder for this project's files
  created_at         timestamptz not null default now()
);

-- Which internal staff work on which project (Coda: People.Projects).
create table project_members (
  project_id uuid references projects(id) on delete cascade,
  person_id  uuid references people(id) on delete cascade,
  primary key (project_id, person_id)
);

create table work_items (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  name              text not null,
  boq_ref           text,
  trade             trade,
  area              text,
  status            work_item_status not null default 'not_started',
  progress          numeric(4,3) not null default 0 check (progress between 0 and 1),
  responsible_id    uuid references people(id),
  planned_start     date,
  planned_finish    date,
  actual_finish     date,
  quantity          numeric(14,2),
  unit              text,
  budget            numeric(14,2),
  visible_to_client boolean not null default true,
  notes             text,
  created_at        timestamptz not null default now()
);

create table purchases (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references projects(id) on delete cascade,
  work_item_id     uuid references work_items(id) on delete set null,
  request          text not null,
  requested_by_id  uuid references people(id),
  date_requested   date not null default current_date,
  needed_by        date,
  quantity         numeric(14,2),
  unit             text,
  supplier_id      uuid references people(id),
  po_number        text,
  amount           numeric(14,2),
  status           purchase_status not null default 'requested',
  procurement_owner_id uuid references people(id),
  payment_status   payment_status not null default 'not_invoiced',
  invoice_no       text,
  delivered_on     date,
  paid_on          date,
  notes            text,
  created_at       timestamptz not null default now()
);

create table site_tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  work_item_id   uuid references work_items(id) on delete set null,
  task           text not null,
  type           site_task_type,
  assigned_to_id uuid references people(id),
  due            date,
  priority       priority not null default 'medium',
  status         site_task_status not null default 'to_do',
  done_on        date,
  notes          text,
  created_at     timestamptz not null default now()
);

-- Files live in Google Drive; this table only keeps the link.
create table attachments (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  work_item_id      uuid references work_items(id) on delete cascade,
  purchase_id       uuid references purchases(id) on delete cascade,
  site_task_id      uuid references site_tasks(id) on delete cascade,
  kind              text not null default 'other',   -- photo, invoice, quotation, drawing, other
  file_name         text not null,
  mime_type         text,
  drive_file_id     text not null,
  uploaded_by_id    uuid references people(id),
  visible_to_client boolean not null default false,
  created_at        timestamptz not null default now()
);

create index on work_items (project_id);
create index on purchases (project_id);
create index on purchases (work_item_id);
create index on site_tasks (project_id);
create index on site_tasks (work_item_id);
create index on attachments (project_id);

-- ─────────────────────── Helper functions for RLS ─────────────────────
create function me() returns people
  language sql stable security definer set search_path = public as
$$ select * from people where user_id = auth.uid() and active $$;

create function my_role() returns person_role
  language sql stable security definer set search_path = public as
$$ select role from people where user_id = auth.uid() and active $$;

create function is_internal() returns boolean
  language sql stable as
$$ select coalesce(my_role() in ('management','site_ops','procurement','accountant'), false) $$;

-- Projects an external client/consultant may see.
create function external_project_ids() returns setof uuid
  language sql stable security definer set search_path = public as
$$ select p.id from projects p
   where (my_role() = 'client'     and p.client_id     = (me()).id)
      or (my_role() = 'consultant' and p.consultant_id = (me()).id) $$;

-- ───────────────────────── Row-level security ─────────────────────────
alter table people          enable row level security;
alter table projects        enable row level security;
alter table project_members enable row level security;
alter table work_items      enable row level security;
alter table purchases       enable row level security;
alter table site_tasks      enable row level security;
alter table attachments     enable row level security;

-- Internal staff read everything.
create policy internal_read on people          for select using (is_internal());
create policy internal_read on projects        for select using (is_internal());
create policy internal_read on project_members for select using (is_internal());
create policy internal_read on work_items      for select using (is_internal());
create policy internal_read on purchases       for select using (is_internal());
create policy internal_read on site_tasks      for select using (is_internal());
create policy internal_read on attachments     for select using (is_internal());

-- Externals: own profile, own projects, client-visible work items and files. Read-only.
create policy self_read     on people      for select using (user_id = auth.uid());
create policy external_read on projects    for select using (id in (select external_project_ids()));
create policy external_read on work_items  for select
  using (visible_to_client and project_id in (select external_project_ids()));
create policy external_read on attachments for select
  using (visible_to_client and project_id in (select external_project_ids()));

-- Management: full control.
create policy mgmt_all on people          for all using (my_role() = 'management') with check (my_role() = 'management');
create policy mgmt_all on projects        for all using (my_role() = 'management') with check (my_role() = 'management');
create policy mgmt_all on project_members for all using (my_role() = 'management') with check (my_role() = 'management');
create policy mgmt_all on work_items      for all using (my_role() = 'management') with check (my_role() = 'management');
create policy mgmt_all on purchases       for all using (my_role() = 'management') with check (my_role() = 'management');
create policy mgmt_all on site_tasks      for all using (my_role() = 'management') with check (my_role() = 'management');
create policy mgmt_all on attachments     for all using (my_role() = 'management') with check (my_role() = 'management');

-- Site operations: run work items and site tasks, raise purchase requests.
create policy siteops_write on work_items for insert with check (my_role() = 'site_ops');
create policy siteops_edit  on work_items for update using (my_role() = 'site_ops') with check (my_role() = 'site_ops');
create policy siteops_write on site_tasks for insert with check (my_role() = 'site_ops');
create policy siteops_edit  on site_tasks for update using (my_role() = 'site_ops') with check (my_role() = 'site_ops');
create policy siteops_request on purchases for insert
  with check (my_role() = 'site_ops' and status = 'requested');

-- Procurement: manage purchases and suppliers.
create policy proc_write on purchases for insert with check (my_role() = 'procurement');
create policy proc_edit  on purchases for update using (my_role() = 'procurement') with check (my_role() = 'procurement');
create policy proc_suppliers on people for insert with check (my_role() = 'procurement' and role = 'supplier');
create policy proc_suppliers_edit on people for update
  using (my_role() = 'procurement' and role = 'supplier') with check (role = 'supplier');

-- Accountant: payment fields on purchases (column limits enforced by trigger below).
create policy acct_edit on purchases for update using (my_role() = 'accountant') with check (my_role() = 'accountant');

-- Any internal user can attach files.
create policy internal_upload on attachments for insert with check (is_internal());

-- Column-level rules on purchases by role.
create function purchases_guard() returns trigger language plpgsql as $$
declare r person_role := my_role();
begin
  if r = 'accountant' then
    if (new.status, new.amount, new.supplier_id, new.po_number, new.request, new.project_id)
       is distinct from
       (old.status, old.amount, old.supplier_id, old.po_number, old.request, old.project_id) then
      raise exception 'Accountants can only change payment details';
    end if;
  elsif r = 'procurement' then
    if (new.payment_status, new.paid_on) is distinct from (old.payment_status, old.paid_on) then
      raise exception 'Only accounts can change payment status';
    end if;
  end if;
  -- Status side effects (Coda buttons: Mark delivered / Mark paid).
  if new.status = 'delivered' and old.status <> 'delivered' and new.delivered_on is null then
    new.delivered_on := current_date;
  end if;
  if new.payment_status = 'paid' and old.payment_status <> 'paid' and new.paid_on is null then
    new.paid_on := current_date;
  end if;
  return new;
end $$;

create trigger purchases_guard before update on purchases
  for each row execute function purchases_guard();

create function site_tasks_done() returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') and new.done_on is null then
    new.done_on := current_date;
  end if;
  return new;
end $$;

create trigger site_tasks_done before insert or update on site_tasks
  for each row execute function site_tasks_done();

-- Default requested_by to the signed-in person.
create function purchases_defaults() returns trigger language plpgsql as $$
begin
  if new.requested_by_id is null then new.requested_by_id := (me()).id; end if;
  return new;
end $$;

create trigger purchases_defaults before insert on purchases
  for each row execute function purchases_defaults();

-- ───────────────────────── Summary views (rollups) ─────────────────────
-- security_invoker makes the views respect the caller's RLS.
create view project_summary with (security_invoker = true) as
select p.*,
  (select count(*) from work_items w where w.project_id = p.id)                          as work_item_count,
  (select avg(w.progress) from work_items w where w.project_id = p.id)                   as avg_progress,
  (select coalesce(sum(amount),0) from purchases x
     where x.project_id = p.id and x.status <> 'rejected')                               as committed_spend,
  (select count(*) from purchases x
     where x.project_id = p.id and x.status not in ('delivered','rejected'))             as open_purchases,
  (select coalesce(sum(amount),0) from purchases x
     where x.project_id = p.id and x.payment_status = 'paid')                            as paid_to_date
from projects p;

create view work_item_summary with (security_invoker = true) as
select w.*,
  (select coalesce(sum(amount),0) from purchases x
     where x.work_item_id = w.id and x.status <> 'rejected')                    as committed_spend,
  (select count(*) from site_tasks t where t.work_item_id = w.id and t.status <> 'done') as open_site_tasks
from work_items w;

create view purchases_view with (security_invoker = true) as
select x.*, (x.needed_by - current_date) as days_until_needed
from purchases x;
