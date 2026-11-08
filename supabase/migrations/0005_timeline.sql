-- Timeline: planned vs actual dates for work items and site tasks.

alter table work_items add column if not exists actual_start date;
alter table site_tasks add column if not exists planned_start date;
alter table site_tasks add column if not exists started_on date;

-- Record actual dates automatically when status changes.
create or replace function work_items_dates() returns trigger language plpgsql as $$
begin
  if new.status <> 'not_started' and new.actual_start is null then
    new.actual_start := current_date;
  end if;
  if new.status = 'done' and new.actual_finish is null then
    new.actual_finish := current_date;
  end if;
  if new.status = 'done' and new.progress < 1 then
    new.progress := 1;
  end if;
  return new;
end $$;

drop trigger if exists work_items_dates on work_items;
create trigger work_items_dates before insert or update on work_items
  for each row execute function work_items_dates();

create or replace function site_tasks_done() returns trigger language plpgsql as $$
begin
  if new.status in ('in_progress','blocked','done') and new.started_on is null then
    new.started_on := current_date;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') and new.done_on is null then
    new.done_on := current_date;
  end if;
  if new.status <> 'done' then
    new.done_on := null;
  end if;
  return new;
end $$;

-- Backfill what we can.
update work_items set actual_start = coalesce(actual_start, created_at::date)
 where status <> 'not_started' and actual_start is null;
update site_tasks set started_on = coalesce(started_on, created_at::date)
 where status <> 'to_do' and started_on is null;

-- Clients may see the timeline of client-visible work items (already covered by RLS).
