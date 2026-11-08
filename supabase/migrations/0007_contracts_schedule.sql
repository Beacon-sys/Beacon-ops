-- Contracts (contractor <-> work items with rates and dates),
-- schedule dependencies, and milestones.

-- 1. Contracts with contractors / suppliers.
create table if not exists contracts (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  vendor_id     uuid not null references people(id),
  number        text,
  title         text not null,
  status        text not null default 'draft'
                check (status in ('draft','signed','in_progress','completed','terminated')),
  start_date    date,
  finish_date   date,
  retention_pct numeric(5,2) default 5,
  link          text,
  notes         text,
  created_at    timestamptz not null default now()
);
create table if not exists contract_items (
  contract_id    uuid references contracts(id) on delete cascade,
  work_item_id   uuid references work_items(id) on delete cascade,
  rate           numeric(14,2),
  quantity       numeric(14,2),        -- defaults to the work item quantity when empty
  start_date     date,
  finish_date    date,
  primary key (contract_id, work_item_id)
);
create index if not exists contracts_project on contracts (project_id);
create index if not exists contracts_vendor on contracts (vendor_id);
create index if not exists contract_items_wi on contract_items (work_item_id);

alter table contracts enable row level security;
alter table contract_items enable row level security;
create policy internal_read on contracts for select using (is_internal());
create policy internal_read on contract_items for select using (is_internal());
create policy contract_write on contracts for all
  using (my_role()::text in ('management','procurement'))
  with check (my_role()::text in ('management','procurement'));
create policy contract_items_write on contract_items for all
  using (my_role()::text in ('management','procurement'))
  with check (my_role()::text in ('management','procurement'));

-- 2. Dependencies between work items (finish-to-start etc., with lag in days).
create table if not exists work_item_dependencies (
  predecessor_id uuid references work_items(id) on delete cascade,
  successor_id   uuid references work_items(id) on delete cascade,
  kind           text not null default 'FS' check (kind in ('FS','SS','FF','SF')),
  lag_days       integer not null default 0,
  primary key (predecessor_id, successor_id),
  check (predecessor_id <> successor_id)
);
alter table work_item_dependencies enable row level security;
create policy internal_read on work_item_dependencies for select using (is_internal());
create policy external_read on work_item_dependencies for select
  using (successor_id in (select id from work_items where visible_to_client and project_id in (select external_project_ids())));
create policy dep_write on work_item_dependencies for all
  using (my_role()::text in ('management','site_ops','tendering'))
  with check (my_role()::text in ('management','site_ops','tendering'));

-- 3. Milestones.
create table if not exists milestones (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  name              text not null,
  planned_date      date not null,
  actual_date       date,
  visible_to_client boolean not null default true,
  created_at        timestamptz not null default now()
);
alter table milestones enable row level security;
create policy internal_read on milestones for select using (is_internal());
create policy external_read on milestones for select
  using (visible_to_client and project_id in (select external_project_ids()));
create policy ms_write on milestones for all
  using (my_role()::text in ('management','site_ops','tendering'))
  with check (my_role()::text in ('management','site_ops','tendering'));

-- 4. Work item cost rate: from its contract when there is one, else the manual rate.
drop view if exists work_item_summary;
create view work_item_summary with (security_invoker = true) as
select w.*,
  coalesce(ci.rate, c.cost_rate)                      as cost_rate,
  coalesce(ci.vendor_id, c.vendor_id)                 as cost_vendor_id,
  ci.contract_id                                      as contract_id,
  coalesce(ci.rate, c.cost_rate) * w.quantity         as cost,
  w.beacon_rate * w.quantity                          as price,
  (select coalesce(sum(amount),0) from purchases x
     where x.work_item_id = w.id and x.status <> 'rejected')                    as committed_spend,
  (select count(*) from site_tasks t where t.work_item_id = w.id and t.status <> 'done') as open_site_tasks,
  (select count(*) from work_item_submittals s where s.work_item_id = w.id)     as submittal_count,
  (select count(*) from attachments a where a.work_item_id = w.id)              as attachment_count
from work_items w
left join work_item_costs c on c.work_item_id = w.id
left join lateral (
  select i.rate, i.contract_id, k.vendor_id
  from contract_items i join contracts k on k.id = i.contract_id
  where i.work_item_id = w.id and k.status <> 'terminated'
  order by k.created_at desc limit 1
) ci on true;

-- 5. Contract totals per contract.
create or replace view contract_summary with (security_invoker = true) as
select k.*,
  (select count(*) from contract_items i where i.contract_id = k.id)                       as item_count,
  (select coalesce(sum(i.rate * coalesce(i.quantity, w.quantity)),0)
     from contract_items i join work_items w on w.id = i.work_item_id where i.contract_id = k.id) as contract_value,
  (select avg(w.progress) from contract_items i join work_items w on w.id = i.work_item_id
     where i.contract_id = k.id)                                                             as progress
from contracts k;
