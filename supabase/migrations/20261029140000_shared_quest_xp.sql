begin;
-- The server verifies quest completion; users cannot choose XP amounts or recipients.
grant select on public.profiles, public.events, public.event_assignments,
  public.event_attendance, public.event_preparation_ratings, public.xp_awards to service_role;
grant insert on public.xp_awards to service_role;
-- Every signed-in account must see the same XP ledger.
grant select on public.xp_awards to authenticated;
drop policy if exists "team reads xp awards" on public.xp_awards;
create policy "team reads xp awards" on public.xp_awards for select to authenticated using (true);
notify pgrst, 'reload schema';
commit;
