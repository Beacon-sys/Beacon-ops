-- Beacon Operations: language per person (English or Arabic) and a cache of
-- Arabic translations of user-entered text (work item names, notes, tasks...),
-- made by Claude so each text is translated only once.

alter table people
  add column if not exists language text not null default 'en'
    check (language in ('en','ar'));

-- Anyone signed in may change their own language (people rows are otherwise
-- edited only by management).
create or replace function set_my_language(lang text) returns void
  language sql security definer set search_path = public as
$$ update people set language = lang where user_id = auth.uid() and lang in ('en','ar') $$;
grant execute on function set_my_language(text) to authenticated;

create table if not exists content_translations (
  lang         text not null check (lang in ('ar','en')),
  source_hash  text not null,          -- sha-256 of the original text
  source_text  text not null,
  translated   text not null,
  created_at   timestamptz not null default now(),
  primary key (lang, source_hash)
);

alter table content_translations enable row level security;
drop policy if exists signed_in_read on content_translations;
drop policy if exists signed_in_add on content_translations;
create policy signed_in_read on content_translations for select using (auth.uid() is not null);
create policy signed_in_add  on content_translations for insert with check (auth.uid() is not null);
-- Management may correct or clear a translation.
drop policy if exists mgmt_fix on content_translations;
create policy mgmt_fix on content_translations for all
  using (my_role() = 'management') with check (my_role() = 'management');
