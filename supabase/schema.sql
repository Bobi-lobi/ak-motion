-- AK-Motion v1 schema for Supabase/Postgres.
-- Run this in the Supabase SQL editor before connecting a real project.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'technician');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.availability_status as enum ('committed', 'backup');
create type public.assignment_role as enum ('Ton', 'Licht', 'Umbau');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'technician',
  created_at timestamptz not null default now()
);

create table public.event_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null,
  contact_name text not null,
  contact_email text not null,
  event_type text not null,
  tech_needs text not null,
  notes text not null default '',
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null,
  event_type text not null,
  status text not null default 'Nicht begonnen',
  contact_name text,
  contact_email text,
  microphone_count integer,
  tech_needs text not null,
  notes text not null default '',
  request_id uuid references public.event_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.event_availability (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.availability_status not null,
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create table public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.assignment_role not null,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id, role)
);

create table public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.assignment_role not null,
  attended boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id, role)
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.event_requests enable row level security;
alter table public.events enable row level security;
alter table public.event_availability enable row level security;
alter table public.event_assignments enable row level security;
alter table public.event_attendance enable row level security;

create policy "profiles are visible to signed in users"
on public.profiles for select
to authenticated
using (true);

create policy "admins manage profiles"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "public can create event requests"
on public.event_requests for insert
to anon
with check (status = 'pending');

create policy "admins manage event requests"
on public.event_requests for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "events visible to signed in users"
on public.events for select
to authenticated
using (true);

create policy "admins manage events"
on public.events for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "availability visible to signed in users"
on public.event_availability for select
to authenticated
using (true);

create policy "technicians manage own availability"
on public.event_availability for insert
to authenticated
with check (profile_id = auth.uid());

create policy "technicians update own availability"
on public.event_availability for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "assignments visible to signed in users"
on public.event_assignments for select
to authenticated
using (true);

create policy "admins manage assignments"
on public.event_assignments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "attendance visible to signed in users"
on public.event_attendance for select
to authenticated
using (true);

create policy "admins manage attendance"
on public.event_attendance for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
