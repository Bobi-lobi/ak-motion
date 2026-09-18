create table if not exists public.chat_read_receipts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  read_at timestamptz not null default now()
);

alter table public.chat_read_receipts enable row level security;

drop policy if exists "team reads chat receipts" on public.chat_read_receipts;
drop policy if exists "members update own chat receipt" on public.chat_read_receipts;

create policy "team reads chat receipts"
on public.chat_read_receipts for select
to authenticated
using (true);

create policy "members update own chat receipt"
on public.chat_read_receipts for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

grant select, insert, update on public.chat_read_receipts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_read_receipts'
  ) then
    alter publication supabase_realtime add table public.chat_read_receipts;
  end if;
end $$;

notify pgrst, 'reload schema';
