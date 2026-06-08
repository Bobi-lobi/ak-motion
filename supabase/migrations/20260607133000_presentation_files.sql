alter table public.event_requests
add column if not exists presentation_files jsonb not null default '[]'::jsonb;

alter table public.events
add column if not exists presentation_files jsonb not null default '[]'::jsonb;
