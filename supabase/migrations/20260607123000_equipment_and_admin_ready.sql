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

alter table public.equipment_items enable row level security;
alter table public.equipment_tags enable row level security;
alter table public.app_options enable row level security;

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
