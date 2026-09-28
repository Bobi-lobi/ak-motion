-- Use the database clock for both typing updates and expiry. Device clocks can
-- differ enough that a six-second client-side window hides every update.
create or replace function public.set_chat_typing(conversation_uuid uuid, is_typing boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or not public.is_approved_team_member()
     or not public.is_chat_member(conversation_uuid) then
    raise exception 'Not a member of this chat' using errcode = '42501';
  end if;

  if is_typing then
    insert into public.chat_typing_status (conversation_id, profile_id, updated_at)
    values (conversation_uuid, auth.uid(), now())
    on conflict (conversation_id, profile_id)
    do update set updated_at = now();
  else
    delete from public.chat_typing_status
    where conversation_id = conversation_uuid and profile_id = auth.uid();
  end if;
end;
$$;

create or replace function public.get_chat_typing(conversation_uuid uuid)
returns table(profile_id uuid) language sql stable security invoker set search_path = public as $$
  select typing.profile_id
  from public.chat_typing_status as typing
  where typing.conversation_id = conversation_uuid
    and typing.profile_id <> auth.uid()
    and typing.updated_at > now() - interval '9 seconds'
    and public.is_approved_team_member()
    and public.is_chat_member(conversation_uuid);
$$;

revoke all on function public.set_chat_typing(uuid, boolean) from public;
revoke all on function public.get_chat_typing(uuid) from public;
grant execute on function public.set_chat_typing(uuid, boolean) to authenticated;
grant execute on function public.get_chat_typing(uuid) to authenticated;
notify pgrst, 'reload schema';
