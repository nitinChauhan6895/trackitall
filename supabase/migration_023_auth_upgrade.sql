-- TrackItAll — migration 023: auth upgrade
-- Paste this whole block into the Supabase SQL editor (Dashboard → SQL → New query) and run.
-- Safe to re-run (CREATE OR REPLACE / DROP IF EXISTS).
--
-- 1. Sign-up no longer asks for a username, so the profile trigger now makes a
--    unique one from the name/email (the old one failed sign-up outright when
--    two emails shared a local part, e.g. john@gmail.com and john@yahoo.com).
-- 2. profiles.email follows auth.users.email after a confirmed email change.
-- 3. cancel_email_change(): lets a signed-in user withdraw a pending change.
-- 4. email_for_username is no longer callable from the browser. It returned
--    the email for ANY username to anyone; the login server action now does
--    this lookup with the service-role key and never sends the email out.

-- ---------------------------------------------------------------------
-- 1. Profile row on sign-up, with a guaranteed-unique username
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base  text;
  candidate text;
  n int := 0;
begin
  base := lower(coalesce(
    nullif(meta ->> 'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'user'
  ));
  -- Usernames are [a-z0-9._-]{3,30}.
  base := regexp_replace(base, '[^a-z0-9._-]', '', 'g');
  if length(base) < 3 then base := rpad(base, 3, '0'); end if;
  base := left(base, 24);

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || (floor(random() * 9000) + 1000)::int::text;
    exit when n > 20;
  end loop;
  if n > 20 then
    candidate := left(base, 18) || substr(replace(new.id::text, '-', ''), 1, 12);
  end if;

  insert into public.profiles (user_id, username, first_name, last_name, email)
  values (
    new.id,
    candidate,
    nullif(coalesce(meta ->> 'first_name', split_part(coalesce(meta ->> 'name', ''), ' ', 1)), ''),
    nullif(coalesce(meta ->> 'last_name', nullif(regexp_replace(coalesce(meta ->> 'name', ''), '^\S+\s*', ''), '')), ''),
    coalesce(meta ->> 'email', new.email)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. Keep profiles.email in step with the confirmed auth email
-- ---------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.sync_profile_email();

-- ---------------------------------------------------------------------
-- 3. Withdraw a pending email change (the caller's own only)
-- ---------------------------------------------------------------------
create or replace function public.cancel_email_change()
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update auth.users
     set email_change = '',
         email_change_token_new = '',
         email_change_token_current = '',
         email_change_confirm_status = 0,
         email_change_sent_at = null
   where id = auth.uid();
end;
$$;

revoke all on function public.cancel_email_change() from public, anon;
grant execute on function public.cancel_email_change() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Lock down the pre-auth username helpers
-- ---------------------------------------------------------------------
revoke execute on function public.email_for_username(text) from public, anon, authenticated;
grant execute on function public.email_for_username(text) to service_role;

revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated, service_role;
