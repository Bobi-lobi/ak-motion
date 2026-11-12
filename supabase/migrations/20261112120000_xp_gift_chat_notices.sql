begin;

alter table public.chat_messages add column if not exists system_event jsonb;
create unique index if not exists chat_xp_gift_award_unique
  on public.chat_messages ((system_event->>'awardId')) where system_event->>'type' = 'xp_gift';

create or replace function public.guard_xp_gift_award()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    if exists (select 1 from public.chat_messages where system_event->>'awardId' = old.id::text) then
      raise exception 'Punktegeschenke bitte zurücknehmen und neu vergeben statt bearbeiten.';
    end if;
  elsif new.reason not like 'quest:%' and auth.uid() is not null then
    if not public.is_admin() then raise exception 'Nur Admins dürfen Punkte verschenken.' using errcode = '42501'; end if;
    new.created_by := auth.uid();
  end if;
  return new;
end $$;
revoke all on function public.guard_xp_gift_award() from public;
drop trigger if exists guard_xp_gift_award on public.xp_awards;
create trigger guard_xp_gift_award before insert or update on public.xp_awards
  for each row execute function public.guard_xp_gift_award();

-- Gift and chat notice are committed together. Quest awards are not gifts.
create or replace function public.publish_xp_gift_notice()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  admin_name text;
  recipient_name text;
begin
  if tg_op = 'INSERT' then
    if new.reason like 'quest:%' or new.created_by is null then return new; end if;
    select name into admin_name from public.profiles where id = new.created_by and role = 'admin';
    if not found then return new; end if;
    select name into recipient_name from public.profiles where id = new.profile_id;
    insert into public.chat_messages (author_id, conversation_id, body, system_event, created_at)
    values (new.created_by, '00000000-0000-0000-0000-000000000001',
      format('%s hat %s %s Punkte geschenkt.', admin_name, recipient_name, new.amount),
      jsonb_build_object('type', 'xp_gift', 'awardId', new.id, 'adminName', admin_name,
        'recipientName', recipient_name, 'amount', new.amount, 'reason', new.reason), new.created_at);
    return new;
  end if;
  if tg_op = 'DELETE' then
    update public.chat_messages set system_event = system_event || jsonb_build_object(
      'revokedAt', now(), 'revokedBy', auth.uid())
    where system_event->>'type' = 'xp_gift' and system_event->>'awardId' = old.id::text;
    return old;
  end if;
  return null;
end $$;
revoke all on function public.publish_xp_gift_notice() from public;
drop trigger if exists xp_gift_chat_notice on public.xp_awards;
create trigger xp_gift_chat_notice after insert or delete on public.xp_awards
  for each row execute function public.publish_xp_gift_notice();

-- System notices cannot be forged, edited or deleted through normal message APIs,
-- even by their author. Only a nested XP-ledger trigger may create/change them.
create or replace function public.protect_chat_system_event()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if pg_trigger_depth() < 2 then
    if tg_op = 'INSERT' and new.system_event is not null then
      raise exception 'Systemmeldungen werden ausschließlich über die Punktevergabe erstellt.';
    elsif tg_op = 'UPDATE' then
      if old.system_event is not null or new.system_event is not null then
        raise exception 'Systemmeldungen können nicht bearbeitet werden.';
      end if;
    elsif tg_op = 'DELETE' and old.system_event is not null then
      raise exception 'Systemmeldungen bleiben im Chat erhalten. Bitte die Punktevergabe rückgängig machen.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists protect_chat_system_event on public.chat_messages;
create trigger protect_chat_system_event before insert or update or delete on public.chat_messages
  for each row execute function public.protect_chat_system_event();

create or replace function public.revoke_xp_gift(message_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare notice jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Nur Admins dürfen Punktegeschenke rückgängig machen.' using errcode = '42501';
  end if;
  select system_event into notice from public.chat_messages where id = message_id for update;
  if notice is null or notice->>'type' <> 'xp_gift' then
    raise exception 'Punkte-Mitteilung wurde nicht gefunden.';
  end if;
  if notice->>'revokedAt' is not null then return; end if;
  delete from public.xp_awards where id = (notice->>'awardId')::uuid and reason not like 'quest:%';
  if not found then raise exception 'Die Punktevergabe wurde nicht gefunden.'; end if;
end $$;
revoke all on function public.revoke_xp_gift(uuid) from public;
grant execute on function public.revoke_xp_gift(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
