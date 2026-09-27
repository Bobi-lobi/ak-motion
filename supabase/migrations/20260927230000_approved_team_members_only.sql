-- A newly registered auth user must not gain team data access before approval.
create or replace function public.is_approved_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles where id = auth.uid()
  );
$$;

revoke all on function public.is_approved_team_member() from public;
grant execute on function public.is_approved_team_member() to authenticated;

do $$
declare target record;
begin
  for target in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    execute format('drop policy if exists "approved team members only" on public.%I', target.table_name);
    execute format(
      'create policy "approved team members only" on public.%I as restrictive for all to authenticated using (public.is_approved_team_member()) with check (public.is_approved_team_member())',
      target.table_name
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
