-- Create supporting extensions
create extension if not exists "pgcrypto";

-- Enum to keep user roles consistent across the application
create type public.user_role as enum ('driver', 'manager', 'admin');

comment on type public.user_role is 'Supported access roles for authenticated users.';

-- Main profile table that mirrors data coming from Supabase Auth
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role public.user_role not null default 'driver',
  is_active boolean not null default true,
  last_sign_in_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is 'Extended profile data synced with Supabase Auth.';
comment on column public.user_profiles.id is 'UUID from auth.users';
comment on column public.user_profiles.email is 'Latest email for the user account.';
comment on column public.user_profiles.role is 'Role used to gate access across the app.';
comment on column public.user_profiles.metadata is 'Raw metadata copied from auth users when available.';

-- Function to keep updated_at in sync
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_profiles_update_timestamp on public.user_profiles;
create trigger user_profiles_update_timestamp
before update on public.user_profiles
for each row execute function public.touch_updated_at();

-- Function to sync new auth users into profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_email text;
  profile_full_name text;
begin
  profile_email := coalesce(new.email, new.raw_user_meta_data->>'email');
  profile_full_name := new.raw_user_meta_data->>'full_name';

  if profile_email is null then
    raise exception 'User email is required to create profile.';
  end if;

  insert into public.user_profiles (id, email, full_name, metadata, last_sign_in_at)
  values (
    new.id,
    profile_email,
    profile_full_name,
    coalesce(new.raw_user_meta_data, '{}'::jsonb),
    new.last_sign_in_at
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        metadata = excluded.metadata,
        last_sign_in_at = excluded.last_sign_in_at,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Function to keep auth updates in sync with profiles
create or replace function public.handle_updated_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_email text;
  profile_full_name text;
begin
  profile_email := coalesce(new.email, new.raw_user_meta_data->>'email');
  profile_full_name := new.raw_user_meta_data->>'full_name';

  update public.user_profiles
  set email = coalesce(profile_email, email),
      full_name = coalesce(profile_full_name, full_name),
      metadata = coalesce(new.raw_user_meta_data, metadata),
      last_sign_in_at = greatest(coalesce(new.last_sign_in_at, last_sign_in_at), last_sign_in_at),
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row execute function public.handle_updated_user();

-- Table that stores login related events for auditability
create table if not exists public.login_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('login_success', 'login_failure', 'logout', 'password_reset')),
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.login_audit_logs is 'Audit trail for authentication events.';
comment on column public.login_audit_logs.metadata is 'Additional context such as error codes or client info.';

create index if not exists login_audit_logs_user_id_idx on public.login_audit_logs (user_id);
create index if not exists login_audit_logs_created_at_idx on public.login_audit_logs (created_at desc);

-- Security policies
alter table public.user_profiles enable row level security;
alter table public.login_audit_logs enable row level security;

create policy "Users can read own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id);

create policy "Service role manages profiles"
  on public.user_profiles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "Users can view own login audit"
  on public.login_audit_logs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own login audit"
  on public.login_audit_logs
  for insert
  with check (auth.uid() = user_id);

create policy "Service role manages login audit"
  on public.login_audit_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Explicit grants so row level policies can take effect
grant usage on type public.user_role to anon, authenticated, service_role;
grant select, update on public.user_profiles to authenticated;
grant select on public.user_profiles to service_role;
grant select, insert on public.login_audit_logs to authenticated;
grant all privileges on public.user_profiles to service_role;
grant all privileges on public.login_audit_logs to service_role;
