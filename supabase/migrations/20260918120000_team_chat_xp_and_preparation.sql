create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint chat_message_has_content check (length(trim(body)) > 0 or jsonb_array_length(attachments) > 0)
);

create table if not exists public.xp_awards (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount between 1 and 10000),
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events
  add column if not exists related_event_id uuid references public.events(id) on delete set null;

create table if not exists public.event_preparation_ratings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rated_by uuid not null references public.profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, rated_by)
);

alter table public.announcements enable row level security;
alter table public.chat_messages enable row level security;
alter table public.xp_awards enable row level security;
alter table public.event_preparation_ratings enable row level security;

drop policy if exists "announcements visible to signed in users" on public.announcements;
drop policy if exists "admins manage announcements" on public.announcements;
create policy "announcements visible to signed in users" on public.announcements
  for select to authenticated using (expires_at is null or expires_at > now());
create policy "admins manage announcements" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "team reads chat" on public.chat_messages;
drop policy if exists "team posts chat" on public.chat_messages;
drop policy if exists "authors and admins delete chat" on public.chat_messages;
create policy "team reads chat" on public.chat_messages
  for select to authenticated using (true);
create policy "team posts chat" on public.chat_messages
  for insert to authenticated with check (author_id = auth.uid());
create policy "authors and admins delete chat" on public.chat_messages
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

drop policy if exists "team reads xp awards" on public.xp_awards;
drop policy if exists "admins manage xp awards" on public.xp_awards;
create policy "team reads xp awards" on public.xp_awards
  for select to authenticated using (true);
create policy "admins manage xp awards" on public.xp_awards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "team reads preparation ratings" on public.event_preparation_ratings;
drop policy if exists "team rates preparation" on public.event_preparation_ratings;
create policy "team reads preparation ratings" on public.event_preparation_ratings
  for select to authenticated using (true);
create policy "team rates preparation" on public.event_preparation_ratings
  for all to authenticated
  using (
    public.is_admin() or (
      rated_by = auth.uid() and exists (
        select 1
        from public.events preparation
        join public.event_assignments assignment on assignment.event_id = preparation.related_event_id
        where preparation.id = event_preparation_ratings.event_id and assignment.profile_id = auth.uid()
      )
    )
  )
  with check (
    public.is_admin() or (
      rated_by = auth.uid() and exists (
        select 1
        from public.events preparation
        join public.event_assignments assignment on assignment.event_id = preparation.related_event_id
        where preparation.id = event_preparation_ratings.event_id and assignment.profile_id = auth.uid()
      )
    )
  );

drop policy if exists "signed in users manage events" on public.events;
drop policy if exists "team reads events" on public.events;
drop policy if exists "team creates events" on public.events;
drop policy if exists "team edits open events" on public.events;
drop policy if exists "team deletes open events" on public.events;
create policy "team reads events" on public.events for select to authenticated using (true);
create policy "team creates events" on public.events for insert to authenticated with check (true);
create policy "team edits open events" on public.events for update to authenticated
  using (public.is_admin() or coalesce(status, '') <> 'Abgeschlossen') with check (true);
create policy "team deletes open events" on public.events for delete to authenticated
  using (public.is_admin() or coalesce(status, '') <> 'Abgeschlossen');

drop policy if exists "signed in users manage assignments" on public.event_assignments;
drop policy if exists "team manages assignments for open events" on public.event_assignments;
create policy "team manages assignments for open events" on public.event_assignments for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.events where events.id = event_assignments.event_id and coalesce(events.status, '') <> 'Abgeschlossen'
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.events where events.id = event_assignments.event_id and coalesce(events.status, '') <> 'Abgeschlossen'
    )
  );

drop policy if exists "signed in users manage attendance" on public.event_attendance;
drop policy if exists "team manages attendance for open events" on public.event_attendance;
create policy "team manages attendance for open events" on public.event_attendance for all to authenticated
  using (
    public.is_admin() or exists (
      select 1 from public.events where events.id = event_attendance.event_id and coalesce(events.status, '') <> 'Abgeschlossen'
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.events where events.id = event_attendance.event_id and coalesce(events.status, '') <> 'Abgeschlossen'
    )
  );

create or replace function public.accept_knowledge_suggestion(suggestion_uuid uuid, editor_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  suggestion_row public.knowledge_suggestions%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Nur Admins dürfen Vorschläge übernehmen.';
  end if;

  select * into suggestion_row from public.knowledge_suggestions where id = suggestion_uuid for update;
  if not found then return; end if;

  update public.knowledge_pages
  set content = concat_ws('<p><br></p>', nullif(trim(content), ''), suggestion_row.content),
      updated_at = now(),
      updated_by = editor_name
  where id = suggestion_row.page_id;

  delete from public.knowledge_suggestions where id = suggestion_uuid;
end;
$$;
grant execute on function public.accept_knowledge_suggestion(uuid, text) to authenticated;

grant select on public.announcements, public.chat_messages, public.xp_awards, public.event_preparation_ratings to authenticated;
grant insert, delete on public.chat_messages to authenticated;
grant insert, update, delete on public.event_preparation_ratings to authenticated;
grant all on public.announcements, public.xp_awards to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['announcements', 'chat_messages', 'xp_awards', 'event_preparation_ratings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
