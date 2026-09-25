create table if not exists public.email_notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  chat_messages boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.email_notification_preferences enable row level security;
drop policy if exists "members manage own email preferences" on public.email_notification_preferences;
create policy "members manage own email preferences" on public.email_notification_preferences
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
grant select, insert, update, delete on public.email_notification_preferences to authenticated;

create or replace function public.create_chat_conversation(
  conversation_name text,
  conversation_description text,
  conversation_kind text,
  conversation_image_url text,
  member_profile_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_conversation_id uuid;
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Anmeldung erforderlich.';
  end if;
  if nullif(trim(conversation_name), '') is null then
    raise exception 'Bitte gib der Gruppe einen Namen.';
  end if;
  if conversation_kind not in ('group', 'direct') then
    raise exception 'Ungültiger Chattyp.';
  end if;
  if coalesce(array_length(member_profile_ids, 1), 0) = 0 then
    raise exception 'Wähle mindestens eine weitere Person aus.';
  end if;
  if conversation_kind = 'direct' and array_length(member_profile_ids, 1) <> 1 then
    raise exception 'Ein Einzelchat braucht genau eine weitere Person.';
  end if;

  insert into public.chat_conversations (name, description, image_url, kind, created_by)
  values (trim(conversation_name), coalesce(conversation_description, ''), nullif(conversation_image_url, ''), conversation_kind, current_profile_id)
  returning id into new_conversation_id;

  insert into public.chat_conversation_members (conversation_id, profile_id)
  select new_conversation_id, selected_profile_id
  from (
    select current_profile_id as selected_profile_id
    union
    select unnest(member_profile_ids)
  ) selected_members;

  return new_conversation_id;
end;
$$;

revoke all on function public.create_chat_conversation(text, text, text, text, uuid[]) from public;
grant execute on function public.create_chat_conversation(text, text, text, text, uuid[]) to authenticated;

notify pgrst, 'reload schema';
