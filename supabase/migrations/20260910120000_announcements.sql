create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.announcements enable row level security;

drop policy if exists "announcements visible to signed in users" on public.announcements;
drop policy if exists "admins manage announcements" on public.announcements;

create policy "announcements visible to signed in users"
on public.announcements for select
to authenticated
using (expires_at is null or expires_at > now());

create policy "admins manage announcements"
on public.announcements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.announcements;
exception
  when duplicate_object then null;
end $$;
