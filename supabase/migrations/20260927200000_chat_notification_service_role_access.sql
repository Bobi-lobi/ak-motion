-- Server-side chat notifications use the Supabase service role. RLS bypass does
-- not imply ordinary PostgreSQL table privileges on this self-hosted instance.
grant usage on schema public to service_role;
grant select on public.chat_messages, public.chat_conversations, public.chat_conversation_members to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;

notify pgrst, 'reload schema';
