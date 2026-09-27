alter table public.chat_conversation_members
  add column if not exists cleared_at timestamptz;

-- Members must not be able to update conversation_id to join another conversation.
revoke update on public.chat_conversation_members from authenticated;

create or replace function public.clear_direct_chat_history(conversation_uuid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.chat_conversations c
    join public.chat_conversation_members m on m.conversation_id = c.id
    where c.id = conversation_uuid and c.kind = 'direct' and m.profile_id = auth.uid()
  ) then
    raise exception 'Dieser Einzelchat ist nicht verfügbar.';
  end if;

  update public.chat_conversation_members
  set cleared_at = now()
  where conversation_id = conversation_uuid and profile_id = auth.uid();
end;
$$;

revoke all on function public.clear_direct_chat_history(uuid) from public;
grant execute on function public.clear_direct_chat_history(uuid) to authenticated;

notify pgrst, 'reload schema';
