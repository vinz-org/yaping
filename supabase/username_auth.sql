-- Yaping username/password auth without Supabase email signup.
-- Run this file in the Supabase SQL editor before deploying the matching frontend code.

create extension if not exists pgcrypto;

create table if not exists public.profile_auth (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    username text not null unique,
    password_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profile_auth_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create table if not exists public.profile_sessions (
    session_token text primary key default encode(gen_random_bytes(32), 'hex'),
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists profile_sessions_user_id_idx on public.profile_sessions(user_id);
create index if not exists profile_sessions_expires_at_idx on public.profile_sessions(expires_at);

alter table public.profile_auth enable row level security;
alter table public.profile_sessions enable row level security;

revoke all on public.profile_auth from anon, authenticated;
revoke all on public.profile_sessions from anon, authenticated;

create or replace function public.normalize_yaping_username(p_username text)
returns text
language sql
immutable
as $$
    select lower(regexp_replace(trim(coalesce(p_username, '')), '^@+', ''));
$$;

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

    if exists (select 1 from public.profile_auth where username = v_username) then
        raise exception 'Username sudah digunakan' using errcode = '23505';
    end if;

    insert into public.profiles (id, username, full_name, avatar_url, bio, updated_at)
    values (v_user_id, v_username, v_username, null, '', now());

    insert into public.profile_auth (user_id, username, password_hash)
    values (v_user_id, v_username, crypt(p_password, gen_salt('bf')));

    insert into public.profile_sessions (user_id)
    values (v_user_id)
    returning session_token, expires_at into v_session_token, v_expires_at;

    select to_jsonb(p) into v_profile
    from public.profiles p
    where p.id = v_user_id;

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

    select to_jsonb(p) into v_profile
    from public.profiles p
    where p.id = v_auth.user_id;

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
    ) then
        raise exception 'Username sudah digunakan' using errcode = '23505';
    end if;

    update public.profile_auth
    set username = v_username,
        updated_at = now()
    where user_id = v_user_id;

    update public.profiles
    set username = v_username,
        full_name = coalesce(nullif(trim(coalesce(p_full_name, '')), ''), v_username),
        bio = coalesce(p_bio, ''),
        avatar_url = nullif(p_avatar_url, ''),
        updated_at = now()
    where id = v_user_id
    returning to_jsonb(public.profiles.*) into v_profile;

    return jsonb_build_object(
        'user', jsonb_build_object('id', v_user_id, 'username', v_username),
        'profile', v_profile,
        'session_token', v_session_token
    );
end;
$$;

grant execute on function public.normalize_yaping_username(text) to anon, authenticated;
grant execute on function public.signup_username(text, text) to anon, authenticated;
grant execute on function public.login_username(text, text) to anon, authenticated;
grant execute on function public.update_profile_authenticated(text, text, text, text, text) to anon, authenticated;
