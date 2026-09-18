create table if not exists public.chat_polls (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  question text not null check (length(trim(question)) > 0),
  allow_multiple boolean not null default false
);

create table if not exists public.chat_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.chat_polls(message_id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  position smallint not null default 0
);

create table if not exists public.chat_poll_votes (
  poll_id uuid not null references public.chat_polls(message_id) on delete cascade,
  option_id uuid not null references public.chat_poll_options(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (option_id, profile_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chat_polls enable row level security;
alter table public.chat_poll_options enable row level security;
alter table public.chat_poll_votes enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "team reads chat polls" on public.chat_polls;
drop policy if exists "authors create chat polls" on public.chat_polls;
drop policy if exists "team reads chat poll options" on public.chat_poll_options;
drop policy if exists "authors create chat poll options" on public.chat_poll_options;
drop policy if exists "team reads chat poll votes" on public.chat_poll_votes;
drop policy if exists "members manage own chat poll votes" on public.chat_poll_votes;
drop policy if exists "members manage own push subscriptions" on public.push_subscriptions;

create policy "team reads chat polls" on public.chat_polls for select to authenticated using (true);
create policy "authors create chat polls" on public.chat_polls for insert to authenticated
  with check (exists (select 1 from public.chat_messages where id = message_id and author_id = auth.uid()));
create policy "team reads chat poll options" on public.chat_poll_options for select to authenticated using (true);
create policy "authors create chat poll options" on public.chat_poll_options for insert to authenticated
  with check (exists (select 1 from public.chat_messages where id = poll_id and author_id = auth.uid()));
create policy "team reads chat poll votes" on public.chat_poll_votes for select to authenticated using (true);
create policy "members manage own chat poll votes" on public.chat_poll_votes for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "members manage own push subscriptions" on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert on public.chat_polls, public.chat_poll_options to authenticated;
grant select, insert, update, delete on public.chat_poll_votes to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['chat_polls', 'chat_poll_options', 'chat_poll_votes'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
