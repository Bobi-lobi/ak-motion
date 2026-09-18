create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  image_url text,
  kind text not null default 'group' check (kind in ('group', 'direct')),
  slug text unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_conversation_members (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

insert into public.chat_conversations (id, name, description, kind, slug)
values
  ('00000000-0000-0000-0000-000000000001', 'Teamchat', 'Der gemeinsame Chat für das gesamte Technik-Team.', 'group', 'team'),
  ('00000000-0000-0000-0000-000000000002', 'Licht', 'Absprachen rund um Lichttechnik und Beleuchtung.', 'group', 'licht'),
  ('00000000-0000-0000-0000-000000000003', 'Ton', 'Absprachen rund um Ton, Mikrofone und Audio.', 'group', 'ton'),
  ('00000000-0000-0000-0000-000000000004', 'Umbau', 'Aufbau, Umbau und Abbau gemeinsam koordinieren.', 'group', 'umbau'),
  ('00000000-0000-0000-0000-000000000005', 'Orga', 'Organisatorische Fragen und interne Abstimmungen.', 'group', 'orga')
on conflict (id) do nothing;

insert into public.chat_conversation_members (conversation_id, profile_id)
select conversation.id, profile.id
from public.chat_conversations conversation
cross join public.profiles profile
where conversation.slug in ('team', 'licht', 'ton', 'umbau', 'orga')
on conflict do nothing;

alter table public.chat_messages
  add column if not exists conversation_id uuid references public.chat_conversations(id) on delete cascade,
  add column if not exists reply_to_message_id uuid references public.chat_messages(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists pinned_at timestamptz,
  add column if not exists pinned_by uuid references public.profiles(id) on delete set null;

update public.chat_messages
set conversation_id = '00000000-0000-0000-0000-000000000001'
where conversation_id is null;

alter table public.chat_messages alter column conversation_id set not null;
alter table public.chat_messages alter column conversation_id set default '00000000-0000-0000-0000-000000000001';

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id, emoji)
);

alter table public.chat_read_receipts add column if not exists conversation_id uuid references public.chat_conversations(id) on delete cascade;
update public.chat_read_receipts receipt
set conversation_id = message.conversation_id
from public.chat_messages message
where receipt.message_id = message.id and receipt.conversation_id is null;
update public.chat_read_receipts set conversation_id = '00000000-0000-0000-0000-000000000001' where conversation_id is null;
alter table public.chat_read_receipts alter column conversation_id set not null;
alter table public.chat_read_receipts drop constraint if exists chat_read_receipts_pkey;
alter table public.chat_read_receipts add primary key (conversation_id, profile_id);

alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_message_reactions enable row level security;

create or replace function public.is_chat_member(conversation_uuid uuid, profile_uuid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_conversation_members
    where conversation_id = conversation_uuid and profile_id = profile_uuid
  );
$$;

create or replace function public.add_profile_to_default_chats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.chat_conversation_members (conversation_id, profile_id)
  select id, new.id from public.chat_conversations where slug in ('team', 'licht', 'ton', 'umbau', 'orga')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists add_profile_to_default_chats on public.profiles;
create trigger add_profile_to_default_chats
after insert on public.profiles
for each row execute function public.add_profile_to_default_chats();

create or replace function public.set_chat_message_pin(message_uuid uuid, should_pin boolean)
returns void language plpgsql security definer set search_path = public as $$
declare target_conversation uuid;
begin
  select conversation_id into target_conversation from public.chat_messages where id = message_uuid;
  if target_conversation is null or not public.is_chat_member(target_conversation) then
    raise exception 'Keine Berechtigung für diesen Chat.';
  end if;
  update public.chat_messages
  set pinned_at = case when should_pin then now() else null end,
      pinned_by = case when should_pin then auth.uid() else null end
  where id = message_uuid;
end;
$$;

drop policy if exists "members read conversations" on public.chat_conversations;
drop policy if exists "members create conversations" on public.chat_conversations;
drop policy if exists "owners update conversations" on public.chat_conversations;
create policy "members read conversations" on public.chat_conversations for select to authenticated
  using (public.is_chat_member(id) or created_by = auth.uid());
create policy "members create conversations" on public.chat_conversations for insert to authenticated
  with check (created_by = auth.uid());
create policy "owners update conversations" on public.chat_conversations for update to authenticated
  using (created_by = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "members read memberships" on public.chat_conversation_members;
drop policy if exists "owners manage memberships" on public.chat_conversation_members;
create policy "members read memberships" on public.chat_conversation_members for select to authenticated
  using (public.is_chat_member(conversation_id));
create policy "owners manage memberships" on public.chat_conversation_members for all to authenticated
  using (exists (select 1 from public.chat_conversations where id = conversation_id and (created_by = auth.uid() or public.is_admin())))
  with check (profile_id = auth.uid() or exists (select 1 from public.chat_conversations where id = conversation_id and (created_by = auth.uid() or public.is_admin())));

drop policy if exists "team reads chat" on public.chat_messages;
drop policy if exists "team posts chat" on public.chat_messages;
drop policy if exists "authors and admins delete chat" on public.chat_messages;
drop policy if exists "members read chat messages" on public.chat_messages;
drop policy if exists "members post chat messages" on public.chat_messages;
drop policy if exists "authors update chat messages" on public.chat_messages;
drop policy if exists "authors and admins delete chat messages" on public.chat_messages;
create policy "members read chat messages" on public.chat_messages for select to authenticated
  using (public.is_chat_member(conversation_id));
create policy "members post chat messages" on public.chat_messages for insert to authenticated
  with check (author_id = auth.uid() and public.is_chat_member(conversation_id));
create policy "authors update chat messages" on public.chat_messages for update to authenticated
  using (author_id = auth.uid() or public.is_admin()) with check (public.is_chat_member(conversation_id));
create policy "authors and admins delete chat messages" on public.chat_messages for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

drop policy if exists "team reads chat receipts" on public.chat_read_receipts;
drop policy if exists "members update own chat receipt" on public.chat_read_receipts;
create policy "members read chat receipts" on public.chat_read_receipts for select to authenticated
  using (public.is_chat_member(conversation_id));
create policy "members update own chat receipt" on public.chat_read_receipts for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and public.is_chat_member(conversation_id));

create policy "members read chat reactions" on public.chat_message_reactions for select to authenticated
  using (exists (select 1 from public.chat_messages where id = message_id and public.is_chat_member(conversation_id)));
create policy "members manage own chat reactions" on public.chat_message_reactions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and exists (select 1 from public.chat_messages where id = message_id and public.is_chat_member(conversation_id)));

drop policy if exists "team reads chat polls" on public.chat_polls;
drop policy if exists "team reads chat poll options" on public.chat_poll_options;
drop policy if exists "team reads chat poll votes" on public.chat_poll_votes;
create policy "members read chat polls" on public.chat_polls for select to authenticated
  using (exists (select 1 from public.chat_messages where id = message_id and public.is_chat_member(conversation_id)));
create policy "members read chat poll options" on public.chat_poll_options for select to authenticated
  using (exists (select 1 from public.chat_messages where id = poll_id and public.is_chat_member(conversation_id)));
create policy "members read chat poll votes" on public.chat_poll_votes for select to authenticated
  using (exists (select 1 from public.chat_messages where id = poll_id and public.is_chat_member(conversation_id)));

grant select, insert, update on public.chat_conversations to authenticated;
grant select, insert, update, delete on public.chat_conversation_members to authenticated;
grant select, insert, update, delete on public.chat_message_reactions to authenticated;
grant update on public.chat_messages to authenticated;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;
grant execute on function public.set_chat_message_pin(uuid, boolean) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['chat_conversations', 'chat_conversation_members', 'chat_message_reactions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
