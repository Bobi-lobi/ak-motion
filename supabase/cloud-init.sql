-- AK-Motion Supabase Cloud bootstrap.
-- Run this once in the Supabase SQL Editor for a new Cloud project.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.user_role as enum ('admin', 'technician');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.availability_status as enum ('committed', 'backup');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assignment_role as enum ('Ton', 'Licht', 'Umbau');
exception when duplicate_object then null;
end $$;

alter type public.assignment_role add value if not exists 'Kleine';
alter type public.assignment_role add value if not exists 'Angel';

do $$ begin
  create type public.knowledge_page_id as enum ('rules', 'guides', 'tech-bible', 'ideas');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'technician',
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists phone text;

create table if not exists public.event_requests (
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
  created_at timestamptz not null default now(),
  presentation_files jsonb not null default '[]'::jsonb
);

create table if not exists public.events (
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
  created_at timestamptz not null default now(),
  presentation_files jsonb not null default '[]'::jsonb
);

create table if not exists public.event_availability (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status public.availability_status not null,
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);

create table if not exists public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.assignment_role not null,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id, role)
);

create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.assignment_role not null,
  attended boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id, role)
);

create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  name text not null,
  email text not null,
  phone text,
  motivation text not null default '',
  password text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_pages (
  id public.knowledge_page_id primary key,
  title text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.knowledge_suggestions (
  id uuid primary key default gen_random_uuid(),
  page_id public.knowledge_page_id not null references public.knowledge_pages(id) on delete cascade,
  content text not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.landing_content (
  id boolean primary key default true,
  hero_title text not null,
  hero_text text not null,
  join_title text not null,
  join_text text not null,
  event_images jsonb not null default '[]'::jsonb,
  team_image text not null default '',
  team_names jsonb not null default '[]'::jsonb,
  impressions jsonb not null default '[]'::jsonb,
  content_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint landing_content_singleton check (id = true)
);

create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  amount integer not null default 1,
  type text not null default '',
  state text not null default '',
  location text not null default '',
  comment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_tags (
  id uuid primary key default gen_random_uuid(),
  column_id text not null check (column_id in ('type', 'state')),
  label text not null,
  color text not null default '#4a4a45',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (column_id, label)
);

create table if not exists public.app_options (
  id uuid primary key default gen_random_uuid(),
  namespace text not null,
  label text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (namespace, label)
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
alter table public.registration_requests enable row level security;
alter table public.knowledge_pages enable row level security;
alter table public.knowledge_suggestions enable row level security;
alter table public.landing_content enable row level security;
alter table public.equipment_items enable row level security;
alter table public.equipment_tags enable row level security;
alter table public.app_options enable row level security;

drop policy if exists "profiles are visible to signed in users" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "public can create event requests" on public.event_requests;
drop policy if exists "admins manage event requests" on public.event_requests;
drop policy if exists "events visible to signed in users" on public.events;
drop policy if exists "admins manage events" on public.events;
drop policy if exists "signed in users manage events" on public.events;
drop policy if exists "availability visible to signed in users" on public.event_availability;
drop policy if exists "technicians manage own availability" on public.event_availability;
drop policy if exists "technicians update own availability" on public.event_availability;
drop policy if exists "assignments visible to signed in users" on public.event_assignments;
drop policy if exists "admins manage assignments" on public.event_assignments;
drop policy if exists "signed in users manage assignments" on public.event_assignments;
drop policy if exists "attendance visible to signed in users" on public.event_attendance;
drop policy if exists "admins manage attendance" on public.event_attendance;
drop policy if exists "signed in users manage attendance" on public.event_attendance;
drop policy if exists "public can create registration requests" on public.registration_requests;
drop policy if exists "admins manage registration requests" on public.registration_requests;
drop policy if exists "knowledge pages visible to signed in users" on public.knowledge_pages;
drop policy if exists "admins manage knowledge pages" on public.knowledge_pages;
drop policy if exists "knowledge suggestions visible to signed in users" on public.knowledge_suggestions;
drop policy if exists "signed in users create knowledge suggestions" on public.knowledge_suggestions;
drop policy if exists "admins manage knowledge suggestions" on public.knowledge_suggestions;
drop policy if exists "landing content visible to everyone" on public.landing_content;
drop policy if exists "admins manage landing content" on public.landing_content;
drop policy if exists "equipment visible to signed in users" on public.equipment_items;
drop policy if exists "signed in users manage equipment" on public.equipment_items;
drop policy if exists "equipment tags visible to signed in users" on public.equipment_tags;
drop policy if exists "signed in users manage equipment tags" on public.equipment_tags;
drop policy if exists "app options visible to signed in users" on public.app_options;
drop policy if exists "signed in users manage app options" on public.app_options;

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

create policy "signed in users manage events"
on public.events for all
to authenticated
using (true)
with check (true);

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

create policy "signed in users manage assignments"
on public.event_assignments for all
to authenticated
using (true)
with check (true);

create policy "attendance visible to signed in users"
on public.event_attendance for select
to authenticated
using (true);

create policy "signed in users manage attendance"
on public.event_attendance for all
to authenticated
using (true)
with check (true);

create policy "public can create registration requests"
on public.registration_requests for insert
to anon
with check (status = 'pending');

create policy "admins manage registration requests"
on public.registration_requests for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "knowledge pages visible to signed in users"
on public.knowledge_pages for select
to authenticated
using (true);

create policy "admins manage knowledge pages"
on public.knowledge_pages for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "knowledge suggestions visible to signed in users"
on public.knowledge_suggestions for select
to authenticated
using (true);

create policy "signed in users create knowledge suggestions"
on public.knowledge_suggestions for insert
to authenticated
with check (author_id = auth.uid());

create policy "admins manage knowledge suggestions"
on public.knowledge_suggestions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "landing content visible to everyone"
on public.landing_content for select
to anon, authenticated
using (true);

create policy "admins manage landing content"
on public.landing_content for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "equipment visible to signed in users"
on public.equipment_items for select
to authenticated
using (true);

create policy "signed in users manage equipment"
on public.equipment_items for all
to authenticated
using (true)
with check (true);

create policy "equipment tags visible to signed in users"
on public.equipment_tags for select
to authenticated
using (true);

create policy "signed in users manage equipment tags"
on public.equipment_tags for all
to authenticated
using (true)
with check (true);

create policy "app options visible to signed in users"
on public.app_options for select
to authenticated
using (true);

create policy "signed in users manage app options"
on public.app_options for all
to authenticated
using (true)
with check (true);

insert into public.equipment_tags (column_id, label, color)
values
  ('state', 'Einwandfrei', '#3f765c'),
  ('state', 'Voll', '#3f765c'),
  ('state', 'Leer', '#4a4a45'),
  ('state', 'Kaputt', '#7d4a48'),
  ('state', 'Ausgeliehen', '#715c8f'),
  ('type', 'Akku', '#765842'),
  ('type', 'Mikrofon', '#69558a'),
  ('type', 'Kabel', '#5f708d'),
  ('type', 'Licht', '#7d6f3c'),
  ('type', 'Pult', '#765842'),
  ('type', 'Sonstiges', '#4a4a45')
on conflict (column_id, label) do nothing;

insert into public.equipment_items (name, amount, type, state, location, comment)
values ('Funkmikrofon', 2, 'Mikrofon', 'Voll', 'Aula Technikschrank', '')
on conflict do nothing;

insert into public.knowledge_pages (id, title, content)
values
  ('rules', 'Regeln', ''),
  ('guides', 'Anleitungen', ''),
  ('tech-bible', 'Technik Bibel', ''),
  ('ideas', 'Ideenwerkstatt', '')
on conflict (id) do nothing;
