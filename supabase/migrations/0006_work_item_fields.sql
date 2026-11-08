-- Work items: BOQ / VO, category, cost vs Beacon rates, new statuses,
-- assigned team, submittals register and document links.

-- 1. Item type, category, Beacon's rate (client-visible).
alter table work_items
  add column if not exists item_type text not null default 'boq' check (item_type in ('boq','vo')),
  add column if not exists category text,
  add column if not exists beacon_rate numeric(14,2);

-- 2. Status: not started, preparations, in progress, ready for inspection, done, blocked.
drop view if exists work_item_summary;
alter table work_items alter column status drop default;
alter table work_items alter column status type text using status::text;
update work_items set status = case status
  when 'awaiting_materials' then 'preparations'
  when 'awaiting_approval'  then 'ready_for_inspection'
  when 'on_hold'            then 'blocked'
  else status end;
alter table work_items alter column status set default 'not_started';
alter table work_items add constraint work_items_status_check
  check (status in ('not_started','preparations','in_progress','ready_for_inspection','done','blocked'));

-- 3. Cost rate: internal only, so it lives in its own table that clients can't read.
create table if not exists work_item_costs (
  work_item_id uuid primary key references work_items(id) on delete cascade,
  cost_rate    numeric(14,2),
  vendor_id    uuid references people(id),     -- contractor/supplier the rate comes from
  updated_at   timestamptz not null default now()
);
alter table work_item_costs enable row level security;
create policy internal_read on work_item_costs for select using (is_internal());
create policy cost_write on work_item_costs for insert
  with check (my_role()::text in ('management','procurement','tendering'));
create policy cost_edit on work_item_costs for update
  using (my_role()::text in ('management','procurement','tendering'))
  with check (my_role()::text in ('management','procurement','tendering'));
create policy cost_delete on work_item_costs for delete using (my_role()::text = 'management');

-- 4. Team members assigned to a work item.
create table if not exists work_item_people (
  work_item_id uuid references work_items(id) on delete cascade,
  person_id    uuid references people(id) on delete cascade,
  primary key (work_item_id, person_id)
);
alter table work_item_people enable row level security;
create policy internal_read on work_item_people for select using (is_internal());
create policy team_write on work_item_people for all
  using (my_role()::text in ('management','site_ops','tendering'))
  with check (my_role()::text in ('management','site_ops','tendering'));

-- 5. Submittals register.
create table if not exists submittals (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  number        text,                 -- e.g. SUB-STR-001
  title         text not null,
  kind          text not null default 'material'
                check (kind in ('material','shop_drawing','method_statement','sample','calculation','other')),
  revision      integer not null default 0,
  status        text not null default 'draft'
                check (status in ('draft','submitted','approved','approved_as_noted','revise_resubmit','rejected')),
  submitted_on  date,
  due_back      date,
  returned_on   date,
  link          text,                 -- Google Drive / document link
  notes         text,
  created_at    timestamptz not null default now()
);
create table if not exists work_item_submittals (
  work_item_id uuid references work_items(id) on delete cascade,
  submittal_id uuid references submittals(id) on delete cascade,
  primary key (work_item_id, submittal_id)
);
alter table submittals enable row level security;
alter table work_item_submittals enable row level security;
create policy internal_read on submittals for select using (is_internal());
create policy external_read on submittals for select using (project_id in (select external_project_ids()));
create policy sub_write on submittals for all
  using (my_role()::text in ('management','site_ops','tendering','procurement'))
  with check (my_role()::text in ('management','site_ops','tendering','procurement'));
create policy internal_read on work_item_submittals for select using (is_internal());
create policy external_read on work_item_submittals for select
  using (submittal_id in (select id from submittals where project_id in (select external_project_ids())));
create policy link_write on work_item_submittals for all
  using (my_role()::text in ('management','site_ops','tendering','procurement'))
  with check (my_role()::text in ('management','site_ops','tendering','procurement'));
create index if not exists submittals_project on submittals (project_id);

-- 6. Attachments can be plain links until Drive upload is connected.
alter table attachments alter column drive_file_id drop not null;
alter table attachments add column if not exists url text;
create policy siteops_attach_delete on attachments for delete using (is_internal() and uploaded_by_id = (me()).id);

-- 7. Summary view with cost and price (cost is null for clients).
create view work_item_summary with (security_invoker = true) as
select w.*,
  c.cost_rate,
  c.vendor_id                                         as cost_vendor_id,
  c.cost_rate * w.quantity                            as cost,
  w.beacon_rate * w.quantity                          as price,
  (select coalesce(sum(amount),0) from purchases x
     where x.work_item_id = w.id and x.status <> 'rejected')                    as committed_spend,
  (select count(*) from site_tasks t where t.work_item_id = w.id and t.status <> 'done') as open_site_tasks,
  (select count(*) from work_item_submittals s where s.work_item_id = w.id)     as submittal_count,
  (select count(*) from attachments a where a.work_item_id = w.id)              as attachment_count
from work_items w
left join work_item_costs c on c.work_item_id = w.id;
