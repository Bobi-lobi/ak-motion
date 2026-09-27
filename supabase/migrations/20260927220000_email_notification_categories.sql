alter table public.email_notification_preferences
  add column if not exists assignments boolean not null default false,
  add column if not exists unstaffed boolean not null default false,
  add column if not exists achievements boolean not null default false,
  add column if not exists admin_updates boolean not null default false,
  add column if not exists announcements boolean not null default true;

create table if not exists public.notification_email_deliveries (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  notification_id text not null,
  attempted_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (profile_id, notification_id)
);

alter table public.notification_email_deliveries enable row level security;
revoke all on public.notification_email_deliveries from anon, authenticated;
grant select, insert, update, delete on public.notification_email_deliveries to service_role;
grant select on public.event_assignments, public.events, public.announcements,
  public.event_requests, public.registration_requests, public.knowledge_suggestions,
  public.profiles to service_role;

notify pgrst, 'reload schema';
