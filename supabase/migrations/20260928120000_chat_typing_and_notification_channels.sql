create table if not exists public.chat_typing_status (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

alter table public.chat_typing_status enable row level security;
drop policy if exists "chat members see typing" on public.chat_typing_status;
create policy "chat members see typing" on public.chat_typing_status for select to authenticated
  using (public.is_chat_member(conversation_id) and public.is_approved_team_member());
drop policy if exists "chat members set own typing" on public.chat_typing_status;
create policy "chat members set own typing" on public.chat_typing_status for insert to authenticated
  with check (profile_id = auth.uid() and public.is_chat_member(conversation_id) and public.is_approved_team_member());
drop policy if exists "chat members update own typing" on public.chat_typing_status;
create policy "chat members update own typing" on public.chat_typing_status for update to authenticated
  using (profile_id = auth.uid() and public.is_chat_member(conversation_id) and public.is_approved_team_member())
  with check (profile_id = auth.uid() and public.is_chat_member(conversation_id) and public.is_approved_team_member());
drop policy if exists "chat members clear own typing" on public.chat_typing_status;
create policy "chat members clear own typing" on public.chat_typing_status for delete to authenticated
  using (profile_id = auth.uid() and public.is_chat_member(conversation_id) and public.is_approved_team_member());
grant select, insert, update, delete on public.chat_typing_status to authenticated;

alter table public.email_notification_preferences
  add column if not exists enabled boolean not null default false,
  add column if not exists new_events boolean not null default true,
  add column if not exists shared_topics_initialized boolean not null default false;
update public.email_notification_preferences
  set enabled = true
  where not enabled and not shared_topics_initialized
    and (chat_messages or assignments or unstaffed or achievements or admin_updates);
alter table public.push_subscriptions
  add column if not exists chat_messages_enabled boolean not null default true,
  add column if not exists new_events_enabled boolean not null default true;
alter table public.events add column if not exists created_by uuid references public.profiles(id) default auth.uid();
create table if not exists public.event_push_deliveries (
  event_id uuid primary key references public.events(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
alter table public.event_push_deliveries enable row level security;
revoke all on public.event_push_deliveries from anon, authenticated;
grant select, insert, delete on public.event_push_deliveries to service_role;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_typing_status') then
    alter publication supabase_realtime add table public.chat_typing_status;
  end if;
end $$;
notify pgrst, 'reload schema';
