create or replace function public.leave_chat_conversation(conversation_uuid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  chat_record public.chat_conversations%rowtype;
  next_owner uuid;
begin
  if auth.uid() is null or not public.is_approved_team_member() then
    raise exception 'Nicht angemeldet.';
  end if;

  select * into chat_record from public.chat_conversations where id = conversation_uuid for update;
  if not found or chat_record.slug = 'team' or chat_record.id = '00000000-0000-0000-0000-000000000001' then
    raise exception 'Dieser Chat kann nicht verlassen werden.';
  end if;
  if not exists (
    select 1 from public.chat_conversation_members
    where conversation_id = conversation_uuid and profile_id = auth.uid()
  ) then
    raise exception 'Du bist kein Mitglied dieses Chats.';
  end if;

  delete from public.chat_conversation_members
  where conversation_id = conversation_uuid and profile_id = auth.uid();

  select profile_id into next_owner from public.chat_conversation_members
  where conversation_id = conversation_uuid order by joined_at, profile_id limit 1;
  if next_owner is null then
    delete from public.chat_conversations where id = conversation_uuid;
  elsif chat_record.created_by = auth.uid() then
    update public.chat_conversations set created_by = next_owner where id = conversation_uuid;
  end if;
end;
$$;

revoke all on function public.leave_chat_conversation(uuid) from public;
grant execute on function public.leave_chat_conversation(uuid) to authenticated;
notify pgrst, 'reload schema';
