alter table public.landing_content
  add column if not exists content_settings jsonb not null default '{}'::jsonb;
