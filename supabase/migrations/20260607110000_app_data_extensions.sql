alter table public.profiles
add column if not exists avatar_url text,
add column if not exists phone text;

alter type public.assignment_role add value if not exists 'Kleine';

create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  name text not null,
  email text not null,
  phone text,
  motivation text not null,
  password text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);

create type public.knowledge_page_id as enum ('rules', 'guides', 'tech-bible', 'ideas');

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
  updated_at timestamptz not null default now(),
  constraint landing_content_singleton check (id = true)
);

alter table public.registration_requests enable row level security;
alter table public.knowledge_pages enable row level security;
alter table public.knowledge_suggestions enable row level security;
alter table public.landing_content enable row level security;

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
