-- Departments: Management, Tendering, Accounting, Operations, Procurement.
-- Adds the Tendering role. (Internal role values stay site_ops / accountant;
-- the app shows them as Operations / Accounting.)

alter type person_role add value if not exists 'tendering' after 'management';

-- Compare as text so this file can run in one go with the new enum value.
create or replace function is_internal() returns boolean
  language sql stable as
$$ select coalesce(my_role()::text in ('management','tendering','site_ops','procurement','accountant'), false) $$;

-- Tendering: create and edit projects while they are being tendered,
-- and their BOQ / work items.
create policy tender_create on projects for insert
  with check (my_role()::text = 'tendering' and status = 'tendering');
create policy tender_edit on projects for update
  using (my_role()::text = 'tendering' and status = 'tendering')
  with check (my_role()::text = 'tendering' and status in ('tendering','active'));

create policy tender_work_create on work_items for insert
  with check (my_role()::text = 'tendering'
              and project_id in (select id from projects where status = 'tendering'));
create policy tender_work_edit on work_items for update
  using (my_role()::text = 'tendering'
         and project_id in (select id from projects where status = 'tendering'))
  with check (my_role()::text = 'tendering');

-- Tendering can add clients and consultants to People.
create policy tender_contacts on people for insert
  with check (my_role()::text = 'tendering' and role::text in ('client','consultant'));
