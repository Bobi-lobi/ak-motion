update storage.buckets
set allowed_mime_types = null,
    file_size_limit = 104857600
where id = 'app-media';

delete from public.chat_conversations
where slug in ('licht', 'ton', 'umbau', 'orga');

create or replace function public.add_profile_to_default_chats()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.chat_conversation_members (conversation_id, profile_id)
  select id, new.id from public.chat_conversations where slug = 'team'
  on conflict do nothing;
  return new;
end;
$$;

notify pgrst, 'reload schema';
