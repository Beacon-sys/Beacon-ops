-- Vendors & contractors list for Procurement.
-- Vendors stay in the people table (purchases already link to it);
-- this adds a "contractor" role and vendor details.

alter type person_role add value if not exists 'contractor' after 'supplier';

alter table people
  add column if not exists vendor_category text,          -- e.g. Concrete, Steel, Electrical works
  add column if not exists trades          text[] default '{}',
  add column if not exists contact_person  text,
  add column if not exists tax_id          text,          -- tax registration no.
  add column if not exists commercial_reg  text,          -- commercial register no.
  add column if not exists address         text,
  add column if not exists payment_terms   text,          -- e.g. 30 days, cash on delivery
  add column if not exists rating          smallint check (rating between 1 and 5),
  add column if not exists notes           text;

-- Procurement manages both suppliers and contractors.
drop policy if exists proc_suppliers on people;
drop policy if exists proc_suppliers_edit on people;
create policy proc_vendors on people for insert
  with check (my_role()::text = 'procurement' and role::text in ('supplier','contractor'));
create policy proc_vendors_edit on people for update
  using (my_role()::text = 'procurement' and role::text in ('supplier','contractor'))
  with check (role::text in ('supplier','contractor'));

-- Spend per vendor (respects the caller's access).
create or replace view vendor_summary with (security_invoker = true) as
select v.id,
  count(x.id) filter (where x.status in ('po_issued','delivered'))                        as orders,
  coalesce(sum(x.amount) filter (where x.status in ('po_issued','delivered')), 0)         as ordered_value,
  coalesce(sum(x.amount) filter (where x.payment_status = 'paid'), 0)                     as paid_value,
  max(x.date_requested)                                                                    as last_order
from people v
left join purchases x on x.supplier_id = v.id
where v.role::text in ('supplier','contractor')
group by v.id;
