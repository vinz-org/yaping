-- Yaping username/password auth without Supabase email signup.
-- Run this file in the Supabase SQL editor before deploying the matching frontend code.

create extension if not exists pgcrypto;

-- Rename the old profile table when it exists. If both tables already exist,
-- the RPC layer below will use users_profile only.
do $$
begin
    if to_regclass('public.users_profile') is null and to_regclass('public.profiles') is not null then
        alter table public.profiles rename to users_profile;
    end if;
end $$;

create table if not exists public.users_profile (
    id uuid primary key default gen_random_uuid(),
    username text not null unique,
    full_name text,
    avatar_url text,
    bio text,
    updated_at timestamptz not null default now()
);

alter table public.users_profile add column if not exists id uuid default gen_random_uuid();
alter table public.users_profile add column if not exists username text;
alter table public.users_profile add column if not exists full_name text;
alter table public.users_profile add column if not exists avatar_url text;
alter table public.users_profile add column if not exists bio text;
alter table public.users_profile add column if not exists updated_at timestamptz default now();

update public.users_profile
set username = 'user_' || replace(id::text, '-', '')
where username is null or trim(username) = '';

update public.users_profile
set updated_at = now()
where updated_at is null;

alter table public.users_profile alter column username set not null;
alter table public.users_profile alter column updated_at set not null;
alter table public.users_profile alter column updated_at set default now();

create unique index if not exists users_profile_username_key on public.users_profile(username);

-- Recreate public RPC functions so their argument names match Supabase REST RPC.
drop function if exists public.update_profile_authenticated(text, text, text, text, text);
drop function if exists public.login_username(text, text);
drop function if exists public.signup_username(text, text);
drop function if exists public.normalize_yaping_username(text);

create or replace function public.normalize_yaping_username(p_username text)
returns text
language sql
immutable
as $$
    select lower(regexp_replace(trim(coalesce(p_username, '')), '^@+', ''));
$$;

create table if not exists public.profile_auth (
    user_id uuid primary key references public.users_profile(id) on delete cascade,
    username text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profile_auth_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table public.profile_auth add column if not exists user_id uuid;
alter table public.profile_auth add column if not exists username text;
alter table public.profile_auth add column if not exists password_hash text;
alter table public.profile_auth add column if not exists created_at timestamptz default now();
alter table public.profile_auth add column if not exists updated_at timestamptz default now();
alter table public.profile_auth alter column created_at set default now();
alter table public.profile_auth alter column updated_at set default now();

alter table public.profile_auth drop constraint if exists profile_auth_username_format;
alter table public.profile_auth
    add constraint profile_auth_username_format check (username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profile_auth_username_key on public.profile_auth(username);

-- Clean up legacy profile password columns. Passwords belong in profile_auth,
-- not users_profile. This fixes NOT NULL errors from older users_profile schemas.
do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users_profile'
          and column_name = 'password_hash'
    ) then
        execute $migrate_password_hash$
            insert into public.profile_auth (user_id, username, password_hash)
            select up.id,
                   public.normalize_yaping_username(up.username),
                   up.password_hash::text
            from public.users_profile up
            where up.id is not null
              and public.normalize_yaping_username(up.username) ~ '^[a-z0-9_]{3,20}$'
              and up.password_hash is not null
              and trim(up.password_hash::text) <> ''
            on conflict do nothing
        $migrate_password_hash$;

        alter table public.users_profile alter column password_hash drop not null;
        alter table public.users_profile drop column password_hash;
    end if;

    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'users_profile'
          and column_name = 'password'
    ) then
        execute $migrate_password$
            insert into public.profile_auth (user_id, username, password_hash)
            select up.id,
                   public.normalize_yaping_username(up.username),
                   crypt(up.password::text, gen_salt('bf'))
            from public.users_profile up
            where up.id is not null
              and public.normalize_yaping_username(up.username) ~ '^[a-z0-9_]{3,20}$'
              and up.password is not null
              and trim(up.password::text) <> ''
            on conflict do nothing
        $migrate_password$;

        alter table public.users_profile alter column password drop not null;
        alter table public.users_profile drop column password;
    end if;
end $$;

create table if not exists public.profile_sessions (
    session_token text primary key default encode(gen_random_bytes(32), 'hex'),
    user_id uuid not null references public.users_profile(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '30 days')
);

alter table public.profile_sessions add column if not exists session_token text default encode(gen_random_bytes(32), 'hex');
alter table public.profile_sessions add column if not exists user_id uuid;
alter table public.profile_sessions add column if not exists created_at timestamptz default now();
alter table public.profile_sessions add column if not exists expires_at timestamptz default (now() + interval '30 days');
alter table public.profile_sessions alter column session_token set default encode(gen_random_bytes(32), 'hex');
alter table public.profile_sessions alter column created_at set default now();
alter table public.profile_sessions alter column expires_at set default (now() + interval '30 days');

-- Ensure old foreign keys point at users_profile after the table rename/migration.
do $$
declare
    v_constraint record;
    v_user_id_attnum smallint;
begin
    select attnum into v_user_id_attnum
    from pg_attribute
    where attrelid = 'public.profile_auth'::regclass
      and attname = 'user_id'
      and not attisdropped;

    for v_constraint in
        select conname
        from pg_constraint
        where conrelid = 'public.profile_auth'::regclass
          and contype = 'f'
          and conkey = array[v_user_id_attnum]::smallint[]
    loop
        execute format('alter table public.profile_auth drop constraint %I', v_constraint.conname);
    end loop;

    alter table public.profile_auth
        add constraint profile_auth_user_id_fkey
        foreign key (user_id) references public.users_profile(id) on delete cascade;
exception
    when duplicate_object then null;
end $$;

do $$
declare
    v_constraint record;
    v_user_id_attnum smallint;
begin
    select attnum into v_user_id_attnum
    from pg_attribute
    where attrelid = 'public.profile_sessions'::regclass
      and attname = 'user_id'
      and not attisdropped;

    for v_constraint in
        select conname
        from pg_constraint
        where conrelid = 'public.profile_sessions'::regclass
          and contype = 'f'
          and conkey = array[v_user_id_attnum]::smallint[]
    loop
        execute format('alter table public.profile_sessions drop constraint %I', v_constraint.conname);
    end loop;

    alter table public.profile_sessions
        add constraint profile_sessions_user_id_fkey
        foreign key (user_id) references public.users_profile(id) on delete cascade;
exception
    when duplicate_object then null;
end $$;

create index if not exists profile_sessions_user_id_idx on public.profile_sessions(user_id);
create index if not exists profile_sessions_expires_at_idx on public.profile_sessions(expires_at);

alter table public.users_profile enable row level security;
alter table public.profile_auth enable row level security;
alter table public.profile_sessions enable row level security;

revoke all on public.profile_auth from anon, authenticated;
revoke all on public.profile_sessions from anon, authenticated;

create or replace function public.signup_username(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_username text := public.normalize_yaping_username(p_username);
    v_user_id uuid := gen_random_uuid();
    v_session_token text;
    v_expires_at timestamptz;
    v_profile jsonb;
begin
    if v_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Username hanya boleh huruf kecil, angka, dan underscore (3-20 karakter)';
    end if;

    if p_password is null or length(p_password) < 6 then
        raise exception 'Password minimal 6 karakter';
    end if;

    if exists (select 1 from public.profile_auth where username = v_username)
        or exists (select 1 from public.users_profile where username = v_username) then
        raise exception 'Username sudah digunakan' using errcode = '23505';
    end if;

    insert into public.users_profile (id, username, full_name, avatar_url, bio, updated_at)
    values (v_user_id, v_username, v_username, null, '', now());

    insert into public.profile_auth (user_id, username, password_hash)
    values (v_user_id, v_username, crypt(p_password, gen_salt('bf')));

    insert into public.profile_sessions (user_id)
    values (v_user_id)
    returning session_token, expires_at into v_session_token, v_expires_at;

    select to_jsonb(up) into v_profile
    from public.users_profile up
    where up.id = v_user_id;

    return jsonb_build_object(
        'user', jsonb_build_object('id', v_user_id, 'username', v_username),
        'profile', v_profile,
        'session_token', v_session_token,
        'expires_at', v_expires_at
    );
end;
$$;

create or replace function public.login_username(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_username text := public.normalize_yaping_username(p_username);
    v_auth public.profile_auth%rowtype;
    v_session_token text;
    v_expires_at timestamptz;
    v_profile jsonb;
begin
    select * into v_auth
    from public.profile_auth
    where username = v_username;

    if not found or v_auth.password_hash <> crypt(coalesce(p_password, ''), v_auth.password_hash) then
        raise exception 'Username atau password salah';
    end if;

    delete from public.profile_sessions
    where expires_at <= now();

    insert into public.profile_sessions (user_id)
    values (v_auth.user_id)
    returning session_token, expires_at into v_session_token, v_expires_at;

    select to_jsonb(up) into v_profile
    from public.users_profile up
    where up.id = v_auth.user_id;

    return jsonb_build_object(
        'user', jsonb_build_object('id', v_auth.user_id, 'username', v_username),
        'profile', v_profile,
        'session_token', v_session_token,
        'expires_at', v_expires_at
    );
end;
$$;

create or replace function public.update_profile_authenticated(
    p_session_token text,
    p_username text,
    p_full_name text,
    p_bio text,
    p_avatar_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_username text := public.normalize_yaping_username(p_username);
    v_user_id uuid;
    v_session_token text;
    v_profile jsonb;
begin
    select user_id, session_token into v_user_id, v_session_token
    from public.profile_sessions
    where session_token = p_session_token
      and expires_at > now();

    if v_user_id is null then
        raise exception 'Sesi login sudah habis. Silakan login ulang.';
    end if;

    if v_username !~ '^[a-z0-9_]{3,20}$' then
        raise exception 'Username hanya boleh huruf kecil, angka, dan underscore (3-20 karakter)';
    end if;

    if exists (
        select 1
        from public.profile_auth
        where username = v_username
          and user_id <> v_user_id
    ) or exists (
        select 1
        from public.users_profile
        where username = v_username
          and id <> v_user_id
    ) then
        raise exception 'Username sudah digunakan' using errcode = '23505';
    end if;

    update public.profile_auth
    set username = v_username,
        updated_at = now()
    where user_id = v_user_id;

    update public.users_profile
    set username = v_username,
        full_name = coalesce(nullif(trim(coalesce(p_full_name, '')), ''), v_username),
        bio = coalesce(p_bio, ''),
        avatar_url = nullif(p_avatar_url, ''),
        updated_at = now()
    where id = v_user_id;

    select to_jsonb(up) into v_profile
    from public.users_profile up
    where up.id = v_user_id;

    return jsonb_build_object(
        'user', jsonb_build_object('id', v_user_id, 'username', v_username),
        'profile', v_profile,
        'session_token', v_session_token
    );
end;
$$;

grant usage on schema public to anon, authenticated;
grant execute on function public.normalize_yaping_username(text) to anon, authenticated;
grant execute on function public.signup_username(text, text) to anon, authenticated;
grant execute on function public.login_username(text, text) to anon, authenticated;
grant execute on function public.update_profile_authenticated(text, text, text, text, text) to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
