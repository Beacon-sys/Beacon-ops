-- Link logins to people by email, in both directions:
-- a person signs up after management added them, or management adds
-- someone who already has a login.

create function link_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update people set user_id = new.id
   where user_id is null and lower(email) = lower(new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function link_new_user();

create function link_person_to_user() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if new.email is not null and new.user_id is null then
    select id into new.user_id from auth.users where lower(email) = lower(new.email) limit 1;
  end if;
  return new;
end $$;

create trigger people_link_user before insert or update of email on people
  for each row execute function link_person_to_user();

-- First management account.
insert into people (name, email, company, role)
values ('Issam Elshafei', 'i.elshafei@beacon-eg.com', 'Beacon', 'management')
on conflict (email) do update set role = 'management', active = true;
