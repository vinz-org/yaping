-- Yaping Supabase Auth v1 profile schema.
-- Run this in Supabase SQL Editor after switching away from manual username RPC auth.
-- Passwords are handled by Supabase Auth, not by users_profile.

-- Remove old manual RPC auth objects.
drop function if exists public.update_profile_authenticated(text, text, text, text, text);
drop function if exists public.login_username(text, text);
drop function if exists public.signup_username(text, text);
drop function if exists public.normalize_yaping_username(text);
drop table if exists public.profile_sessions cascade;
drop table if exists public.profile_auth cascade;

-- Keep existing profile data, but use the requested users_profile table name.
do $$
begin
    if to_regclass('public.users_profile') is null and to_regclass('public.profiles') is not null then
        alter table public.profiles rename to users_profile;
    end if;
end $$;

create table if not exists public.users_profile (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null,
    email text,
    full_name text,
    avatar_url text,
    bio text,
    updated_at timestamptz not null default now()
);

alter table public.users_profile add column if not exists id uuid;
alter table public.users_profile add column if not exists username text;
alter table public.users_profile add column if not exists email text;
alter table public.users_profile add column if not exists full_name text;
alter table public.users_profile add column if not exists avatar_url text;
alter table public.users_profile add column if not exists bio text;
alter table public.users_profile add column if not exists updated_at timestamptz default now();

-- Drop legacy password columns that caused NOT NULL signup errors.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users_profile'
          and column_name = 'password'
    ) then
        alter table public.users_profile alter column password drop not null;
        alter table public.users_profile drop column password;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users_profile'
          and column_name = 'password_hash'
    ) then
        alter table public.users_profile alter column password_hash drop not null;
        alter table public.users_profile drop column password_hash;
    end if;
end $$;

update public.users_profile
set username = coalesce(nullif(trim(username), ''), 'user_' || replace(id::text, '-', ''))
where username is null or trim(username) = '';

update public.users_profile
set updated_at = now()
where updated_at is null;

alter table public.users_profile alter column username set not null;
alter table public.users_profile alter column updated_at set not null;
alter table public.users_profile alter column updated_at set default now();

create unique index if not exists users_profile_username_key on public.users_profile(username);
create unique index if not exists users_profile_email_key on public.users_profile(email) where email is not null;

alter table public.users_profile enable row level security;

drop policy if exists users_profile_select_own on public.users_profile;
drop policy if exists users_profile_insert_own on public.users_profile;
drop policy if exists users_profile_update_own on public.users_profile;

create policy users_profile_select_own
on public.users_profile
for select
to authenticated
using (auth.uid() = id);

create policy users_profile_insert_own
on public.users_profile
for insert
to authenticated
with check (auth.uid() = id);

create policy users_profile_update_own
on public.users_profile
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

grant select, insert, update on public.users_profile to authenticated;

select pg_notify('pgrst', 'reload schema');
